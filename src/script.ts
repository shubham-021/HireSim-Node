import { ChatOpenAI } from "@langchain/openai";
import { DEF_SCRIPT_PROMPT } from "./mine/prompts";
import { SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({model:"gpt-4o-mini"});

async function def_script(resume:string , role:string="FullStack dev"): Promise<string>{
    const system_prompt = DEF_SCRIPT_PROMPT(resume,role);
    const message = [new SystemMessage(system_prompt)];
    const response = await model.invoke(message);

    return response.text ;
}

export {def_script};