/*
  Warnings:

  - You are about to drop the `LeadCaptureForm` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LeadCaptureForm" DROP CONSTRAINT "LeadCaptureForm_userTagId_fkey";

-- DropTable
DROP TABLE "LeadCaptureForm";

-- CreateTable
CREATE TABLE "FormConfig" (
    "id" SERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "formTitle" TEXT NOT NULL DEFAULT 'Contact Me',
    "nameField" TEXT,
    "emailField" TEXT,
    "phoneField" TEXT,
    "companyField" TEXT,
    "messageField" TEXT,
    "submitButtonText" TEXT NOT NULL DEFAULT 'Submit',
    "thankYouMessage" TEXT NOT NULL DEFAULT 'Thank you for your message. I will get back to you soon!',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormConfig_tagId_key" ON "FormConfig"("tagId");

-- CreateIndex
CREATE INDEX "FormConfig_tagId_idx" ON "FormConfig"("tagId");

-- AddForeignKey
ALTER TABLE "FormConfig" ADD CONSTRAINT "FormConfig_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "UserTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
