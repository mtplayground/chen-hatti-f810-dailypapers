import { ItemKind, Locale, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const dashboardItemInclude = {
  paper: true,
  repository: true,
  summaries: true,
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ItemInclude;

type DashboardItemRecord = Prisma.ItemGetPayload<{
  include: typeof dashboardItemInclude;
}>;

export type DashboardSummary = {
  language: "EN" | "ZH";
  headline: string | null;
  summary: string;
  keyPoints: string[];
};

export type DashboardTag = {
  slug: string;
  nameEn: string;
  nameZh: string | null;
  color: string | null;
};

export type DashboardPaper = {
  id: string;
  createdAt: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  important: boolean;
  archived: boolean;
  title: string;
  authors: string[];
  venue: string | null;
  publishedAt: string | null;
  revisedAt: string | null;
  arxivId: string | null;
  doi: string | null;
  landingUrl: string | null;
  pdfUrl: string | null;
  abstract: string | null;
  problemStatement: string | null;
  methodology: string | null;
  keyFindings: string | null;
  limitations: string | null;
  relevanceScore: number | null;
  relevanceNotes: string | null;
  summaries: DashboardSummary[];
  tags: DashboardTag[];
};

export type DashboardRepository = {
  id: string;
  createdAt: string;
  important: boolean;
  archived: boolean;
  name: string;
  owner: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  primaryLanguage: string | null;
  lastUpdatedAt: string | null;
  techStack: string[];
  installDifficulty: string;
  researchValueScore: number | null;
  researchValueNotes: string | null;
  summaries: DashboardSummary[];
  tags: DashboardTag[];
};

export type DashboardDay = {
  date: string;
  papers: DashboardPaper[];
  repositories: DashboardRepository[];
};

export type DashboardData = {
  days: DashboardDay[];
  stats: {
    papers: number;
    repositories: number;
    notes: number;
  };
};

export async function getDashboardData(): Promise<DashboardData> {
  const [items, notes] = await Promise.all([
    prisma.item.findMany({
      where: {
        archived: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      include: dashboardItemInclude,
    }),
    prisma.note.count(),
  ]);

  const grouped = new Map<string, DashboardDay>();
  let paperCount = 0;
  let repositoryCount = 0;

  for (const item of items) {
    const date = dateKey(item.createdAt);
    const day =
      grouped.get(date) ??
      ({
        date,
        papers: [],
        repositories: [],
      } satisfies DashboardDay);

    if (!grouped.has(date)) {
      grouped.set(date, day);
    }

    if (item.kind === ItemKind.PAPER && item.paper !== null) {
      paperCount += 1;
      day.papers.push(toDashboardPaper(item));
      continue;
    }

    if (item.kind === ItemKind.REPOSITORY && item.repository !== null) {
      repositoryCount += 1;
      day.repositories.push(toDashboardRepository(item));
    }
  }

  return {
    days: [...grouped.values()],
    stats: {
      papers: paperCount,
      repositories: repositoryCount,
      notes,
    },
  };
}

function toDashboardPaper(item: DashboardItemRecord): DashboardPaper {
  const paper = item.paper;

  if (paper === null) {
    throw new Error(`Item ${item.id} is missing paper details.`);
  }

  return {
    id: item.id,
    createdAt: item.createdAt.toISOString(),
    sourceUrl: item.sourceUrl,
    canonicalUrl: item.canonicalUrl,
    important: item.important,
    archived: item.archived,
    title: paper.title,
    authors: paper.authors,
    venue: paper.venue,
    publishedAt: dateOrNull(paper.publishedAt),
    revisedAt: dateOrNull(paper.revisedAt),
    arxivId: paper.arxivId,
    doi: paper.doi,
    landingUrl: paper.landingUrl,
    pdfUrl: paper.pdfUrl,
    abstract: paper.abstract,
    problemStatement: paper.problemStatement,
    methodology: paper.methodology,
    keyFindings: paper.keyFindings,
    limitations: paper.limitations,
    relevanceScore: paper.relevanceScore,
    relevanceNotes: paper.relevanceNotes,
    summaries: item.summaries.map(toDashboardSummary),
    tags: item.tags.map((itemTag) => toDashboardTag(itemTag.tag)),
  };
}

function toDashboardRepository(item: DashboardItemRecord): DashboardRepository {
  const repository = item.repository;

  if (repository === null) {
    throw new Error(`Item ${item.id} is missing repository details.`);
  }

  return {
    id: item.id,
    createdAt: item.createdAt.toISOString(),
    important: item.important,
    archived: item.archived,
    name: repository.name,
    owner: repository.owner,
    url: repository.url,
    description: repository.description,
    stars: repository.stars,
    forks: repository.forks,
    primaryLanguage: repository.primaryLanguage,
    lastUpdatedAt: dateOrNull(repository.lastUpdatedAt),
    techStack: repository.techStack,
    installDifficulty: repository.installDifficulty,
    researchValueScore: repository.researchValueScore,
    researchValueNotes: repository.researchValueNotes,
    summaries: item.summaries.map(toDashboardSummary),
    tags: item.tags.map((itemTag) => toDashboardTag(itemTag.tag)),
  };
}

function toDashboardSummary(summary: DashboardItemRecord["summaries"][number]): DashboardSummary {
  return {
    language: summary.language === Locale.ZH ? "ZH" : "EN",
    headline: summary.headline,
    summary: summary.summary,
    keyPoints: summary.keyPoints,
  };
}

function toDashboardTag(tag: DashboardItemRecord["tags"][number]["tag"]): DashboardTag {
  return {
    slug: tag.slug,
    nameEn: tag.nameEn,
    nameZh: tag.nameZh,
    color: tag.color,
  };
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateOrNull(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}
