/*
  Warnings:

  - You are about to drop the `InterviewResposne` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `score` to the `Interview` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."InterviewResposne" DROP CONSTRAINT "InterviewResposne_interviewId_fkey";

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "score" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."InterviewResposne";

-- CreateTable
CREATE TABLE "InterviewResponse" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "remark" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,

    CONSTRAINT "InterviewResponse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InterviewResponse" ADD CONSTRAINT "InterviewResponse_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
