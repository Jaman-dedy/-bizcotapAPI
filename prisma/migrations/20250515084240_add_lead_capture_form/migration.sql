-- CreateTable
CREATE TABLE "LeadCaptureForm" (
    "id" SERIAL NOT NULL,
    "nameField" BOOLEAN NOT NULL DEFAULT false,
    "emailField" BOOLEAN NOT NULL DEFAULT false,
    "phoneField" BOOLEAN NOT NULL DEFAULT false,
    "messageField" BOOLEAN NOT NULL DEFAULT false,
    "companyField" BOOLEAN NOT NULL DEFAULT false,
    "submitButtonText" TEXT NOT NULL DEFAULT 'Submit',
    "thankYouMessage" TEXT NOT NULL DEFAULT 'Thank you for your submission!',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userTagId" INTEGER NOT NULL,

    CONSTRAINT "LeadCaptureForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadCaptureForm_userTagId_key" ON "LeadCaptureForm"("userTagId");

-- CreateIndex
CREATE INDEX "LeadCaptureForm_userTagId_idx" ON "LeadCaptureForm"("userTagId");

-- AddForeignKey
ALTER TABLE "LeadCaptureForm" ADD CONSTRAINT "LeadCaptureForm_userTagId_fkey" FOREIGN KEY ("userTagId") REFERENCES "UserTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
