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
                    .compile({checkpointer: this.checkpointer});
    }


    private start = async (state:STATE) => {
        const PROMPT = DEF_INTERVIEWER(state.script);
        const messages = [
            new SystemMessage(PROMPT),
            ...state.messages
        ]
    
        const res = await this.model.invoke(messages);
    
        return {messages: [...state.messages , new AIMessage(res.text)]}
    }

    private input = (state:STATE) => {
        const res = interrupt("Response: ");
        return {messages: [...state.messages , new HumanMessage(res)]}
    }

    private judge_end = async (state:STATE) => {
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
        console.log("invoke_graph");
        console.log(script);
        const config = {configurable:{thread_id}};
        let result = await this.app.invoke({script,messages:[]},config);

        console.log("RESULT: ",result);

        while(result.__interrupt__){
            const lastMessage = result.messages[result.messages.length-1];
            console.log("LastMessage: ",lastMessage);
            
            const userResponse = await getUserInput(lastMessage.text);
            result = await this.app.invoke(
                new Command({resume:userResponse}),
                config
            )
        }
    }

    async stream_audio(llmResponse:string , pc:PeerConnection , ws:WebSocket){
        console.log("LLM: ",llmResponse);
        try {
            const response = await this.speech_model.audio.speech.create({
                model: "gpt-4o-mini-tts",
                voice: "nova",
                input: llmResponse,
                response_format: "pcm"
            });

            const buffer = Buffer.from(await response.arrayBuffer());
            const samples = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
            console.log("Total samples:", samples.length);
            console.log("Total bytes:", buffer.length);
            
            const chunkSize = 480;
            let chunkCount = 0;

            for(let i = 0; i < samples.length; i += chunkSize){
                const end = Math.min(i + chunkSize, samples.length);
                const chunkLength = end - i;
                const chunk = new Int16Array(chunkSize);
                
                for(let j = 0; j < chunkLength; j++){
                    chunk[j] = samples[i + j];
                }

                console.log(`Chunk ${chunkCount}: length=${chunk.length}, bytes=${chunk.byteLength}`);
                pc.onData(chunk, 48000);
                chunkCount++;

                await new Promise(resolve => setTimeout(resolve, 10));
            }

            ws.send(JSON.stringify({type:"user_turn"}));
        } catch(error) {
            console.error('TTS error:', error);
            throw error;
        }
    }

    
}