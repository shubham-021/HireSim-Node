import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai"
import "dotenv/config";
import { STATE , JUDGE_RES, STATE_ANNOTATION, JUDGE_EOI } from "./types";
import { resume } from "./resume";
import { DEF_EOI, DEF_INTERVIEWER, JUDGE_PROMPT, DEF_SCRIPT_PROMPT } from "./prompts";
import { Command, interrupt, StateGraph } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ask } from "./io";

const checkpointer = new MemorySaver();
const model = new ChatOpenAI({ model: "gpt-4o-mini" });

async function interviewer(state:STATE){
    const INT_PROMPT = DEF_INTERVIEWER(state.script);
    const messages=[
        new SystemMessage(INT_PROMPT),
        ...state.messages
    ]
    // console.log(messages);
    const res = await model.invoke(messages);
    return {messages : [...state.messages , new AIMessage(res.text)]}
}

async function judge_end(state:STATE){
    const model_with_structured_output = model.withStructuredOutput(JUDGE_EOI);
    const JUD_PROMPT = DEF_EOI(state.script);
    const message = [
        new SystemMessage(JUD_PROMPT),
        ...state.messages
    ]
    const res = await model_with_structured_output.invoke(message);
    console.log(res);
    return (res.end_of_interview) ? "__end__" : "user_input";
}

function take_user_input(state:STATE){
    const res = interrupt("Response: ");
    return {messages: [...state.messages , new HumanMessage(res)]}
}

async function judge_user_res(state:STATE){
    const model_with_structured_output = model.withStructuredOutput(JUDGE_RES)
    const message = [
        new SystemMessage(JUDGE_PROMPT),
        ...state.messages
    ]

    const res = await model_with_structured_output.invoke(message);
    if(res.related_to_interview){
        return "take_interview";
    }else{
        state.messages.push(new AIMessage("Please be consistent with interview process , this will affect you score and review"));
        return "user_input";
    }
}

const app = new StateGraph(STATE_ANNOTATION)
            .addNode("take_interview",interviewer)
            .addNode("user_input",take_user_input)
            // // .addNode("judge_res",)
            // .addEdge("__start__","make_script")
            // .addEdge("make_script","take_interview")
            // .addConditionalEdges("take_interview",judge_end)
            // .addConditionalEdges("user_input",judge_user_res)
            // // .addEdge("judge_convo","__end__")
            .compile({checkpointer})

let initial_state:STATE = {
    resume , 
    script: "" , 
    messages: [] , 
    related_to_interview: true ,
    postInterview : {
        score:0,
        qa_array:[],
        remarks: ""
    }
}
let config = { configurable: { thread_id: "conversation-num-2"}}; 

async function invoke_graph() {
  const invoke = async (input: any) => {
    let last: any = null;
    const res = await app.invoke(input,config);
    console.log(res.messages[res.messages.length-1]);
    last = res;
    return last;
  };

  let out = await invoke(initial_state);
  while (out?.__interrupt__) {
    const user = await ask("Response: ");
    out = await invoke(new Command({ resume: user }));
  }
}

invoke_graph();