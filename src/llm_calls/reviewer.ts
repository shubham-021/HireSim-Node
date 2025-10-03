import { ChatOpenAI } from "@langchain/openai";
import output from "../types/review";
import PROMPT from "../prompts/review";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({ model: "gpt-4o-mini" });

type QnA = {question:string , answer:string}[];

async function review(props:QnA){
    const model_with_structured_output = model.withStructuredOutput(output);
    const messages = [
        new SystemMessage(PROMPT),
        new HumanMessage(JSON.stringify(props))
    ]

    const res = await model_with_structured_output.invoke(messages);

    return res;
}