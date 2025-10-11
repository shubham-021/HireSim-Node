/*
  Warnings:

  - You are about to drop the column `answers` on the `Interview` table. All the data in the column will be lost.
  - You are about to drop the column `question` on the `Interview` table. All the data in the column will be lost.
  - You are about to drop the column `remarks` on the `Interview` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `Interview` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Interview" DROP COLUMN "answers",
DROP COLUMN "question",
DROP COLUMN "remarks",
DROP COLUMN "score";

-- CreateTable
CREATE TABLE "InterviewResposne" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "remark" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,

    CONSTRAINT "InterviewResposne_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InterviewResposne" ADD CONSTRAINT "InterviewResposne_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
