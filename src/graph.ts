import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import "dotenv/config";
import { STATE , JUDGE_RES, STATE_ANNOTATION, JUDGE_EOI } from "./types";
import { resume } from "./resume";
import { DEF_EOI, DEF_INTERVIEWER, JUDGE_PROMPT, SCRIPT_PROMPT } from "./prompts";
import { StateGraph } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ask } from "./io";

const checkpointer = new MemorySaver();
const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash",
    temperature: 0
})

async function take_user_query(state:STATE){
    console.log(state.messages);
    const userAnswer = await ask("You> ");
    const user_response = [new HumanMessage(userAnswer)];

    return {messages : user_response};
}

async function judge_eoi_llm(state:STATE){
    const model_with_structured_output = model.withStructuredOutput(JUDGE_EOI);
    const PROMPT = DEF_EOI(state.script);
    const messagesArray = (state.messages as any)?.toArray?.() ?? [];
    const messages = [
        new SystemMessage(PROMPT),
        ...(messagesArray.length > 0 ? messagesArray : [new HumanMessage("Hello! I'm ready to start.")])
    ] 

    const response = await model_with_structured_output.invoke(messages);
    console.log("EOI :" , response.end_of_interview);

    return { end_of_interview: response.end_of_interview };
}

async function handle_off_topic_response(state: STATE) {
    const feedback_message = new AIMessage(
        `Please stay focused on the interview. Your previous response was off-topic.
        Let me repeat the question to help you provide a relevant answer.`
    );
    return { messages: [feedback_message] };
}

function route_after_user_input(state: STATE): string {
    return state.related_to_interview ? "take_interview" : "handle_off_topic";
}

async function judge_response_llm(state:STATE){
    const model_with_structured_output = model.withStructuredOutput(JUDGE_RES);
    const messages = [
        new SystemMessage(JUDGE_PROMPT),
        state.messages[state.messages.length-1]
    ]

    const response = await model_with_structured_output.invoke(messages);
    console.log("Related to int: ",response.related_to_interview);

    if (!response.related_to_interview) {
        console.log("Stay on topic! Off-topic responses may affect your score.");
    }

    return { related_to_interview: response.related_to_interview };
}

function route_after_interview(state: STATE): string {
    return state.end_of_interview ? "__end__" : "user_input";
}

async function script_maker(state:STATE){
    const messages = [
        new SystemMessage(SCRIPT_PROMPT),
        new HumanMessage(state.resume)
    ];

    const response = await model.invoke(messages);
    // console.log(response.text);
    return { script : response.text };
}

async function interviewer_llm(state:STATE){
    const PROMPT = DEF_INTERVIEWER(state.script);
    // console.log(PROMPT);
    const messages = [
        new SystemMessage(PROMPT),
        ...(state.messages.length > 0 ? state.messages : [new HumanMessage("Let's begin the interview.")])
    ]

    const response = await model.invoke(messages);
    console.log(response.text);
    return { messages : new AIMessage(response.text)};
}

const app = new StateGraph(STATE_ANNOTATION)
                    .addNode("make_script" , script_maker)
                    .addNode("take_interview" , interviewer_llm)
                    .addNode("check_eoi" , judge_eoi_llm)
                    .addNode("check_user_query",judge_response_llm)
                    .addNode("user_input" , take_user_query)
                    .addNode("handle_off_topic", handle_off_topic_response)
                    .addEdge("__start__","make_script")
                    .addEdge("make_script","take_interview")
                    .addEdge("take_interview","check_eoi")
                    .addConditionalEdges("check_eoi", route_after_interview)
                    .addEdge("user_input", "check_user_query")
                    .addConditionalEdges("check_user_query", route_after_user_input)
                    .addEdge("handle_off_topic", "user_input")
                    .compile();

let config = { configurable: { thread_id: "conversation-num-1" } };                

async function invoke_graph(){
    const initial_state = {
        resume , 
        script: "" , 
        messages: [] , 
        related_to_interview: true , 
        end_of_interview: false , 
        postInterview : {
            score:0,
            qa_array:[],
            remarks: ""
        }
    }

    const response = await app.invoke(initial_state);
    console.log(response.messages);
}

invoke_graph();