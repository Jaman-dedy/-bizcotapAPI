-- CreateTable
CREATE TABLE "TagView" (
    "id" SERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "tuid" TEXT NOT NULL,
    "viewerIp" TEXT,
    "location" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagAction" (
    "id" SERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "tuid" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "viewerIp" TEXT,
    "location" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TagView_tagId_idx" ON "TagView"("tagId");

-- CreateIndex
CREATE INDEX "TagView_createdAt_idx" ON "TagView"("createdAt");

-- CreateIndex
CREATE INDEX "TagView_tuid_idx" ON "TagView"("tuid");

-- CreateIndex
CREATE INDEX "TagAction_tagId_idx" ON "TagAction"("tagId");

-- CreateIndex
CREATE INDEX "TagAction_action_idx" ON "TagAction"("action");

-- CreateIndex
CREATE INDEX "TagAction_createdAt_idx" ON "TagAction"("createdAt");

-- CreateIndex
CREATE INDEX "TagAction_tuid_idx" ON "TagAction"("tuid");

-- AddForeignKey
ALTER TABLE "TagView" ADD CONSTRAINT "TagView_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "UserTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAction" ADD CONSTRAINT "TagAction_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "UserTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
