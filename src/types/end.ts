import z from "zod";

export const END_OF_INTERVIEW = z.object({
    end_of_interview: z.boolean().describe("Describes whether the following conversation in the interview process is ended or not")
})