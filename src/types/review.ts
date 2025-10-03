import z, { output } from "zod";

const output = z.array(z.object({
    question: z.string().describe("Question asked by the interviewer"),
    answer: z.string().describe("Response given for the question by the cnadidate"),
    score: z.number().describe("Score out of 10 , based on the response given by the candidate according to the question"),
    remark: z.string().describe("Remark about the response with respect to the question.")
}))

export default output