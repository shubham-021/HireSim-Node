import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import z from "zod";

export const STATE_ANNOTATION = Annotation.Root({
    script: Annotation<string>(),
    messages: Annotation<(HumanMessage|AIMessage|SystemMessage)[]>(),
    // postInterview: Annotation<{
    //     qa_array: {question: string , answer: string , review: string}[],
    //     score: number,
    //     remarks: string
    // }>()
});

export type STATE = typeof STATE_ANNOTATION.State;

export const JUDGE_RES = z.object({
    related_to_interview : z.boolean().describe("Describes whether the user query is in relation to the interview process or not.")
})

export const JUDGE_EOI = z.object({
    end_of_interview: z.boolean().describe("Describes whether the following conversation in the interview process is ended or not")
})
