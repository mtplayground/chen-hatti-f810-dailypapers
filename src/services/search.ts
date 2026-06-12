import { ItemKind, Locale, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  searchItemsSchema,
  type SearchItemsData,
  type SearchItemsInput,
} from "@/validators/search";

const searchItemInclude = {
  paper: true,
  repository: true,
  summaries: true,
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ItemInclude;

type SearchItemRecord = Prisma.ItemGetPayload<{
  include: typeof searchItemInclude;
}>;

type SearchIdRow = {
  id: string;
  rank: number;
};

export type SearchSummary = {
  language: "EN" | "ZH";
  headline: string | null;
  summary: string;
  keyPoints: string[];
};

export type SearchTag = {
  slug: string;
  nameEn: string;
  nameZh: string | null;
  color: string | null;
};

export type SearchResultItem = {
  id: string;
  type: "PAPER" | "REPOSITORY";
  createdAt: string;
  updatedAt: string;
  important: boolean;
  canonicalUrl: string | null;
  sourceUrl: string | null;
  title: string;
  subtitle: string | null;
  url: string | null;
  date: string | null;
  relevanceScore: number | null;
  summaries: SearchSummary[];
  tags: SearchTag[];
  paper: SearchPaperPayload | null;
  repository: SearchRepositoryPayload | null;
};

export type SearchPaperPayload = {
  title: string;
  authors: string[];
  venue: string | null;
  publishedAt: string | null;
  revisedAt: string | null;
  abstract: string | null;
  arxivId: string | null;
  doi: string | null;
  landingUrl: string | null;
  pdfUrl: string | null;
  relevanceScore: number | null;
};

export type SearchRepositoryPayload = {
  name: string;
  owner: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  primaryLanguage: string | null;
  lastUpdatedAt: string | null;
  techStack: string[];
  researchValueScore: number | null;
};

export type SearchItemsResult = {
  query: SearchItemsData;
  count: number;
  items: SearchResultItem[];
};

export async function searchItems(input: SearchItemsInput): Promise<SearchItemsResult> {
  const data = searchItemsSchema.parse(input);
  const idRows = await findMatchingItemIds(data);

  if (idRows.length === 0) {
    return {
      query: data,
      count: 0,
      items: [],
    };
  }

  const rankById = new Map(idRows.map((row) => [row.id, row.rank]));
  const items = await prisma.item.findMany({
    where: {
      id: {
        in: idRows.map((row) => row.id),
      },
    },
    include: searchItemInclude,
  });

  const ordered = items
    .sort((left, right) => {
      const rankDelta = (rankById.get(right.id) ?? 0) - (rankById.get(left.id) ?? 0);

      if (rankDelta !== 0) {
        return rankDelta;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    })
    .map(toSearchResultItem);

  return {
    query: data,
    count: ordered.length,
    items: ordered,
  };
}

async function findMatchingItemIds(data: SearchItemsData) {
  const whereClauses: Prisma.Sql[] = [Prisma.sql`i.archived = false`];

  if (data.type !== undefined) {
    whereClauses.push(Prisma.sql`i.kind = ${data.type}::"ItemKind"`);
  }

  if (data.date !== undefined) {
    const start = new Date(`${data.date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 86_400_000);

    whereClauses.push(Prisma.sql`i."createdAt" >= ${start} AND i."createdAt" < ${end}`);
  }

  if (data.from !== undefined) {
    whereClauses.push(Prisma.sql`i."createdAt" >= ${new Date(`${data.from}T00:00:00.000Z`)}`);
  }

  if (data.to !== undefined) {
    whereClauses.push(
      Prisma.sql`i."createdAt" < ${new Date(new Date(`${data.to}T00:00:00.000Z`).getTime() + 86_400_000)}`,
    );
  }

  if (data.minRelevance !== undefined) {
    whereClauses.push(
      Prisma.sql`COALESCE(p."relevanceScore", r."researchValueScore") >= ${data.minRelevance}`,
    );
  }

  if (data.maxRelevance !== undefined) {
    whereClauses.push(
      Prisma.sql`COALESCE(p."relevanceScore", r."researchValueScore") <= ${data.maxRelevance}`,
    );
  }

  if (data.q !== undefined) {
    whereClauses.push(
      Prisma.sql`search_text.searchable ILIKE ${`%${escapeLike(data.q)}%`} ESCAPE '\\'`,
    );
  }

  if (data.topic !== undefined && data.topic.length > 0) {
    whereClauses.push(
      Prisma.sql`(
      EXISTS (
        SELECT 1
        FROM item_tags topic_it
        JOIN tags topic_t ON topic_t.id = topic_it."tagId"
        WHERE topic_it."itemId" = i.id
          AND (
            topic_t.slug = ANY(${data.topic})
            OR topic_t."nameEn" ILIKE ANY(${data.topic.map((topic) => `%${escapeLike(topic)}%`)})
            OR topic_t."nameZh" ILIKE ANY(${data.topic.map((topic) => `%${escapeLike(topic)}%`)})
          )
      )
      OR EXISTS (
        SELECT 1
        FROM unnest(r."techStack") AS stack(value)
        WHERE stack.value ILIKE ANY(${data.topic.map((topic) => `%${escapeLike(topic)}%`)})
      )
      )`,
    );
  }

  const rows = await prisma.$queryRaw<SearchIdRow[]>`
    SELECT
      i.id,
      CASE
        WHEN ${data.q ?? ""} = '' THEN 0
        ELSE ts_rank_cd(search_text.document, plainto_tsquery('simple', ${data.q ?? ""}))
      END AS rank
    FROM items i
    LEFT JOIN papers p ON p."itemId" = i.id
    LEFT JOIN repositories r ON r."itemId" = i.id
    LEFT JOIN LATERAL (
      SELECT string_agg(concat_ws(' ', s.headline, s.summary, array_to_string(s."keyPoints", ' ')), ' ') AS value
      FROM summaries s
      WHERE s."itemId" = i.id
    ) summary_text ON true
    LEFT JOIN LATERAL (
      SELECT string_agg(concat_ws(' ', t.slug, t."nameEn", t."nameZh"), ' ') AS value
      FROM item_tags it
      JOIN tags t ON t.id = it."tagId"
      WHERE it."itemId" = i.id
    ) tag_text ON true
    LEFT JOIN LATERAL (
      SELECT
        concat_ws(
          ' ',
          p.title,
          array_to_string(p.authors, ' '),
          p.venue,
          p.abstract,
          p."problemStatement",
          p.methodology,
          p."keyFindings",
          p.limitations,
          p."relevanceNotes",
          r.name,
          r.owner,
          r.description,
          r."primaryLanguage",
          r.readme,
          array_to_string(r."techStack", ' '),
          r."installNotes",
          r."researchValueNotes",
          summary_text.value,
          tag_text.value
        ) AS searchable,
        to_tsvector(
          'simple',
          concat_ws(
            ' ',
            p.title,
            array_to_string(p.authors, ' '),
            p.venue,
            p.abstract,
            r.name,
            r.owner,
            r.description,
            r.readme,
            summary_text.value,
            tag_text.value
          )
        ) AS document
    ) search_text ON true
    WHERE ${Prisma.join(whereClauses, " AND ")}
    ORDER BY rank DESC, i."createdAt" DESC
    LIMIT ${data.take}
  `;

  return rows;
}

function toSearchResultItem(item: SearchItemRecord): SearchResultItem {
  if (item.kind === ItemKind.PAPER && item.paper !== null) {
    return {
      id: item.id,
      type: "PAPER",
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      important: item.important,
      canonicalUrl: item.canonicalUrl,
      sourceUrl: item.sourceUrl,
      title: item.paper.title,
      subtitle: item.paper.authors.join(", ") || item.paper.venue,
      url: item.paper.landingUrl ?? item.paper.pdfUrl ?? item.canonicalUrl,
      date: dateOrNull(item.paper.publishedAt),
      relevanceScore: item.paper.relevanceScore,
      summaries: item.summaries.map(toSearchSummary),
      tags: item.tags.map((itemTag) => toSearchTag(itemTag.tag)),
      paper: {
        title: item.paper.title,
        authors: item.paper.authors,
        venue: item.paper.venue,
        publishedAt: dateOrNull(item.paper.publishedAt),
        revisedAt: dateOrNull(item.paper.revisedAt),
        abstract: item.paper.abstract,
        arxivId: item.paper.arxivId,
        doi: item.paper.doi,
        landingUrl: item.paper.landingUrl,
        pdfUrl: item.paper.pdfUrl,
        relevanceScore: item.paper.relevanceScore,
      },
      repository: null,
    };
  }

  if (item.kind === ItemKind.REPOSITORY && item.repository !== null) {
    return {
      id: item.id,
      type: "REPOSITORY",
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      important: item.important,
      canonicalUrl: item.canonicalUrl,
      sourceUrl: item.sourceUrl,
      title: `${item.repository.owner}/${item.repository.name}`,
      subtitle: item.repository.description,
      url: item.repository.url,
      date: dateOrNull(item.repository.lastUpdatedAt),
      relevanceScore: item.repository.researchValueScore,
      summaries: item.summaries.map(toSearchSummary),
      tags: item.tags.map((itemTag) => toSearchTag(itemTag.tag)),
      paper: null,
      repository: {
        name: item.repository.name,
        owner: item.repository.owner,
        url: item.repository.url,
        description: item.repository.description,
        stars: item.repository.stars,
        forks: item.repository.forks,
        primaryLanguage: item.repository.primaryLanguage,
        lastUpdatedAt: dateOrNull(item.repository.lastUpdatedAt),
        techStack: item.repository.techStack,
        researchValueScore: item.repository.researchValueScore,
      },
    };
  }

  throw new Error(`Item ${item.id} is missing ${item.kind.toLowerCase()} details.`);
}

function toSearchSummary(summary: SearchItemRecord["summaries"][number]): SearchSummary {
  return {
    language: summary.language === Locale.ZH ? "ZH" : "EN",
    headline: summary.headline,
    summary: summary.summary,
    keyPoints: summary.keyPoints,
  };
}

function toSearchTag(tag: SearchItemRecord["tags"][number]["tag"]): SearchTag {
  return {
    slug: tag.slug,
    nameEn: tag.nameEn,
    nameZh: tag.nameZh,
    color: tag.color,
  };
}

function dateOrNull(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
