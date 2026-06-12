-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('EN', 'ZH');

-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "language" "Locale" NOT NULL,
    "headline" TEXT,
    "summary" TEXT NOT NULL,
    "keyPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedBy" TEXT,
    "promptVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_tags" (
    "itemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_tags_pkey" PRIMARY KEY ("itemId","tagId")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "language" "Locale" NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "summaries_language_idx" ON "summaries"("language");

-- CreateIndex
CREATE UNIQUE INDEX "summaries_itemId_language_key" ON "summaries"("itemId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_nameEn_idx" ON "tags"("nameEn");

-- CreateIndex
CREATE INDEX "item_tags_tagId_idx" ON "item_tags"("tagId");

-- CreateIndex
CREATE INDEX "notes_language_idx" ON "notes"("language");

-- CreateIndex
CREATE UNIQUE INDEX "notes_itemId_language_key" ON "notes"("itemId", "language");

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

