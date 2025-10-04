import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai"
import "dotenv/config";
import { STATE , JUDGE_RES, STATE_ANNOTATION, JUDGE_EOI } from "./types";
import { resume } from "./resume";
import { DEF_EOI, DEF_INTERVIEWER, JUDGE_PROMPT, SCRIPT_PROMPT } from "./prompts";
import { Command, interrupt, StateGraph } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ask } from "./io";

const checkpointer = new MemorySaver();
const model = new ChatOpenAI({ model: "gpt-4o-mini" });

function user_query_node(state:STATE){
    const value = interrupt("Waiting for user response:")

    return {messages: [...state.messages , new HumanMessage(value)]};
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
                    .addNode("user_input" , user_query_node)
                    .addEdge("__start__","make_script")
                    .addEdge("make_script","take_interview")
                    .addConditionalEdges("take_interview", judge_eoi_llm)
                    .addEdge("user_input", "take_interview")
                    // .addConditionalEdges("user_input",judge_response_llm)
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

   let result = await app.invoke(initial_state, config);
   initial_state = result;

   console.log("Interviewer: ", initial_state.messages[initial_state.messages.length - 1]);

    while (!initial_state.end_of_interview) {
        const userResponse = await ask("Your answer: ");
        result = await app.invoke(new Command({resume: userResponse}),config);
        initial_state = result;
        console.log("Interviewer: ", initial_state.messages[initial_state.messages.length - 1]);
    }
}

invoke_graph();