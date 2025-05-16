-- First drop the existing foreign key constraint
ALTER TABLE "FormConfig" DROP CONSTRAINT IF EXISTS "FormConfig_tagId_fkey";

-- Add the tagIdNumeric column to maintain backward compatibility
ALTER TABLE "FormConfig" ADD COLUMN IF NOT EXISTS "tagIdNumeric" INTEGER;

-- Move existing data to preserve relationships
UPDATE "FormConfig" SET "tagIdNumeric" = "tagId"::INTEGER WHERE "tagId" IS NOT NULL;

-- Change the tagId column to TEXT type
ALTER TABLE "FormConfig" ALTER COLUMN "tagId" TYPE TEXT USING "tagId"::TEXT;

-- Make tagId nullable (so we can have either tagId or tagIdNumeric)
ALTER TABLE "FormConfig" ALTER COLUMN "tagId" DROP NOT NULL;

-- Add a unique constraint to tagIdNumeric (required for one-to-one relation)
ALTER TABLE "FormConfig" ADD CONSTRAINT "FormConfig_tagIdNumeric_key" UNIQUE ("tagIdNumeric");

-- Add a foreign key for tagIdNumeric to maintain backward compatibility
ALTER TABLE "FormConfig" ADD CONSTRAINT "FormConfig_tagIdNumeric_fkey" 
  FOREIGN KEY ("tagIdNumeric") REFERENCES "UserTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create an index on the text-based tagId field
CREATE INDEX IF NOT EXISTS "FormConfig_tagId_text_idx" ON "FormConfig"("tagId");
CREATE INDEX IF NOT EXISTS "FormConfig_tagIdNumeric_idx" ON "FormConfig"("tagIdNumeric");