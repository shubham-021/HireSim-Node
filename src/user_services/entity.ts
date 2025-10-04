import { ChatOpenAI } from "@langchain/openai";
import { STATE, STATE_ANNOTATION } from "../types/state_type";
import { Command, interrupt, MemorySaver, StateGraph } from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { END_OF_INTERVIEW } from "../types/end";
import { DEF_EOI } from "../prompts/end";
import { DEF_INTERVIEWER } from "../prompts/interview";
import OpenAI from "openai";
import PeerConnection from "./rtc";
import { WebSocket } from "ws";

export class Entity{
    private model = new ChatOpenAI({model: "gpt-4o-mini"});
    private speech_model = new OpenAI();
    private checkpointer = new MemorySaver();
    private app: any;
    

    constructor(){
        this.app = new StateGraph(STATE_ANNOTATION)
                    .addNode("take_interview" , this.start)
                    .addNode("user_input" , this.input)
                    .addEdge("__start__","take_interview")
                    .addConditionalEdges("take_interview",this.judge_end)
                    .compile()
    }


    private async start(state:STATE){
        const PROMPT = DEF_INTERVIEWER(state.script);
        const messages = [
            new SystemMessage(PROMPT),
            ...state.messages
        ]
    
        const res = await this.model.invoke(messages);
    
        return {messages: [...state.messages , new AIMessage(res.text)]}
    }

    private input(state:STATE){
        const res = interrupt("Response: ");
        return {messages: [...state.messages , new HumanMessage(res)]}
    }

    private async judge_end(state:STATE){
        const model_with_structured_output = this.model.withStructuredOutput(END_OF_INTERVIEW);
        const PROMPT = DEF_EOI(state.script);
        const messages = [
            new SystemMessage(PROMPT),
            ...state.messages
        ]
    
        const res = await model_with_structured_output.invoke(messages);
    
        return (res.end_of_interview) ? "__end__" : "user_input";
    }
    
    async invoke_graph(
            script:string , 
            getUserInput: (aiMessage: string) => Promise<string> , 
            thread_id:string="default-threads"
        ){
        const config = {configurable:{thread_id}};
        let result = await this.app.invoke({script,messages:[]},config);

        while(result.__interrupt__){
            const lastMessage = result.messages[result.messages.length-1];
            const userResponse = await getUserInput(lastMessage.text);
            result = await this.app.invoke(
                new Command({resume:userResponse}),
                config
            )
        }
    }

    async stream_audio(llmResponse:string , pc:PeerConnection , ws:WebSocket){
        const stream = this.speech_model.chat.completions.stream({
            model: "gpt-4o-mini-tts",
            modalities: ["text","audio"],
            audio:{voice: 'coral', format: 'opus'},
            messages:[{role:'user' , content: llmResponse}]
        });

        for await(const event of stream as any){
            if(event.type === "response.output_audio.delta"){
                const opusPacket = Buffer.from(event.delta, "base64");
                pc.pushOpus(opusPacket , Date.now() , 20);
            }else if(event.type === "response.completed"){
                ws.send(JSON.stringify({type:"user_turn"}));
            }
        }

    }

    
}