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

const take_user_query = async (state:STATE) => {
    console.log(state.messages);
    const userAnswer = await ask("You> ");
    const user_response = new HumanMessage(userAnswer);

    return {messages : [...state.messages , user_response]};
}

async function judge_eoi_llm(state:STATE){
    const model_with_structured_output = model.withStructuredOutput(JUDGE_EOI);
    const PROMPT = DEF_EOI(state.script);
    const messages = [
        new SystemMessage(PROMPT),
        ...(state.messages.length > 0 ? state.messages : [new HumanMessage("Hello! I'm ready to start.")])
    ] 

    const response = await model_with_structured_output.invoke(messages);
    console.log("EOI :" , response.end_of_interview);

    return (response.end_of_interview) ? "__end__" : "user_input";
}

async function handle_off_topic_response(state: STATE) {
    const feedback_message = new AIMessage(
        `Please stay focused on the interview. Your previous response was off-topic.
        Let me repeat the question to help you provide a relevant answer.`
    );
    return { messages: [feedback_message] };
}

// function route_after_user_input(state: STATE): string {
//     return state.related_to_interview ? "take_interview" : "handle_off_topic";
// }

async function judge_response_llm(state:STATE){
    if(state.messages.length === 0){
        return "user_input";
    }
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

    return (response.related_to_interview) ? "take_interview" : "user_input";
}

// function route_after_interview(state: STATE): string {
//     return state.end_of_interview ? "__end__" : "user_input";
// }

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
    console.log("\n"+response.text);
    return { messages : [...state.messages , new AIMessage(response.text)]};
}

const app = new StateGraph(STATE_ANNOTATION)
                    .addNode("make_script" , script_maker)
                    .addNode("take_interview" , interviewer_llm)
                    .addNode("user_input" , take_user_query)
                    .addEdge("__start__","make_script")
                    .addEdge("make_script","take_interview")
                    .addConditionalEdges("take_interview", judge_eoi_llm)
                    .addConditionalEdges("user_input",judge_response_llm)
                    .compile({checkpointer});

let config = { configurable: { thread_id: "conversation-num-1" } };                

async function invoke_graph(){
    let initial_state:STATE = {
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

    app.invoke(initial_state,config);

    // while(!initial_state.end_of_interview){
    //     // console.log(initial_state.messages);
    //     const result = await app.invoke(initial_state, config);
    //     console.log("\n" + result.messages[result.messages.length - 1].content);
    //     initial_state = result;

    //     initial_state.end_of_interview = await judge_eoi_llm(initial_state);

    //     if(!initial_state.end_of_interview){
    //         const userInput = await ask("You> ");
    //         initial_state.messages.push(new HumanMessage(userInput));
    //         // initial_state.related_to_interview = await judge_response_llm(initial_state)
    //     }
    // }
    // const response  = await app.invoke(initial_state);
    // console.log(response.messages);
}

invoke_graph();