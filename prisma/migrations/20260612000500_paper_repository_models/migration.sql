-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('PAPER', 'REPOSITORY');

-- CreateEnum
CREATE TYPE "InstallDifficulty" AS ENUM ('UNKNOWN', 'EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "sourceUrl" TEXT,
    "canonicalUrl" TEXT,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papers" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "venue" TEXT,
    "publishedAt" TIMESTAMP(3),
    "revisedAt" TIMESTAMP(3),
    "arxivId" TEXT,
    "doi" TEXT,
    "landingUrl" TEXT,
    "pdfUrl" TEXT,
    "abstract" TEXT,
    "problemStatement" TEXT,
    "methodology" TEXT,
    "keyFindings" TEXT,
    "limitations" TEXT,
    "analysis" JSONB,
    "relevanceScore" INTEGER,
    "relevanceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "description" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "primaryLanguage" TEXT,
    "lastUpdatedAt" TIMESTAMP(3),
    "readme" TEXT,
    "techStack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "installDifficulty" "InstallDifficulty" NOT NULL DEFAULT 'UNKNOWN',
    "installNotes" TEXT,
    "researchValueScore" INTEGER,
    "researchValueNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "items_canonicalUrl_key" ON "items"("canonicalUrl");

-- CreateIndex
CREATE INDEX "items_kind_archived_important_createdAt_idx" ON "items"("kind", "archived", "important", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "papers_itemId_key" ON "papers"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "papers_arxivId_key" ON "papers"("arxivId");

-- CreateIndex
CREATE UNIQUE INDEX "papers_doi_key" ON "papers"("doi");

-- CreateIndex
CREATE INDEX "papers_publishedAt_idx" ON "papers"("publishedAt");

-- CreateIndex
CREATE INDEX "papers_relevanceScore_idx" ON "papers"("relevanceScore");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_itemId_key" ON "repositories"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_url_key" ON "repositories"("url");

-- CreateIndex
CREATE INDEX "repositories_owner_name_idx" ON "repositories"("owner", "name");

-- CreateIndex
CREATE INDEX "repositories_stars_idx" ON "repositories"("stars");

-- CreateIndex
CREATE INDEX "repositories_lastUpdatedAt_idx" ON "repositories"("lastUpdatedAt");

-- CreateIndex
CREATE INDEX "repositories_researchValueScore_idx" ON "repositories"("researchValueScore");

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

