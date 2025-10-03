import { ChatOpenAI } from "@langchain/openai";
import { STATE, STATE_ANNOTATION } from "../types/state_type";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DEF_INTERVIEWER } from "../prompts/interview";
import { interrupt, StateGraph } from "@langchain/langgraph";
import { DEF_EOI } from "../prompts/end";
import { END_OF_INTERVIEW } from "../types/end";

const model = new ChatOpenAI({model: "gpt-4o-mini"});

async function start(state:STATE){
    const PROMPT = DEF_INTERVIEWER(state.script);
    const messages = [
        new SystemMessage(PROMPT),
        ...state.messages
    ]

    const res = await model.invoke(messages);

    return {messages: [...state.messages , new AIMessage(res.text)]}
}

function input(state:STATE){
    const res = interrupt("Response: ");
    return {messages: [...state.messages , new HumanMessage(res)]}
}

async function judge_end(state:STATE){
    const model_with_structured_output = model.withStructuredOutput(END_OF_INTERVIEW);
    const PROMPT = DEF_EOI(state.script);
    const messages = [
        new SystemMessage(PROMPT),
        ...state.messages
    ]

    const res = await model_with_structured_output.invoke(messages);

    return (res.end_of_interview) ? "__end__" : "user_input";
}

const app = new StateGraph(STATE_ANNOTATION)
                .addNode("take_interview" , start)
                .addNode("user_input" , input)
                .addEdge("__start__","take_interview")
                .addConditionalEdges("take_interview",judge_end)
                .compile()

function invoke_graph(script:string){

}