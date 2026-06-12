import { ItemKind, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  createPaperItemSchema,
  createRepositoryItemSchema,
  itemIdSchema,
  listItemsSchema,
  updateItemStatusSchema,
  type CreatePaperItemInput,
  type CreateRepositoryItemInput,
  type ListItemsInput,
  type UpdateItemStatusInput,
} from "@/validators/items";

const itemInclude = {
  paper: true,
  repository: true,
  summaries: true,
  notes: true,
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ItemInclude;

type ItemWithRelations = Prisma.ItemGetPayload<{
  include: typeof itemInclude;
}>;

function nullableJson(value: unknown) {
  return value === undefined || value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

export async function createPaperItem(input: CreatePaperItemInput) {
  const data = createPaperItemSchema.parse(input);

  return prisma.item.create({
    data: {
      kind: ItemKind.PAPER,
      sourceUrl: data.sourceUrl ?? null,
      canonicalUrl: data.canonicalUrl ?? null,
      important: data.important ?? false,
      archived: data.archived ?? false,
      paper: {
        create: {
          title: data.title,
          authors: data.authors,
          venue: data.venue ?? null,
          publishedAt: data.publishedAt ?? null,
          revisedAt: data.revisedAt ?? null,
          arxivId: data.arxivId ?? null,
          doi: data.doi ?? null,
          landingUrl: data.landingUrl ?? null,
          pdfUrl: data.pdfUrl ?? null,
          abstract: data.abstract ?? null,
          problemStatement: data.problemStatement ?? null,
          methodology: data.methodology ?? null,
          keyFindings: data.keyFindings ?? null,
          limitations: data.limitations ?? null,
          analysis: nullableJson(data.analysis),
          relevanceScore: data.relevanceScore ?? null,
          relevanceNotes: data.relevanceNotes ?? null,
        },
      },
    },
    include: itemInclude,
  });
}

export async function createRepositoryItem(input: CreateRepositoryItemInput) {
  const data = createRepositoryItemSchema.parse(input);

  return prisma.item.create({
    data: {
      kind: ItemKind.REPOSITORY,
      sourceUrl: data.sourceUrl ?? data.url,
      canonicalUrl: data.canonicalUrl ?? data.url,
      important: data.important ?? false,
      archived: data.archived ?? false,
      repository: {
        create: {
          name: data.name,
          url: data.url,
          owner: data.owner,
          description: data.description ?? null,
          stars: data.stars,
          forks: data.forks,
          primaryLanguage: data.primaryLanguage ?? null,
          lastUpdatedAt: data.lastUpdatedAt ?? null,
          readme: data.readme ?? null,
          techStack: data.techStack,
          installDifficulty: data.installDifficulty,
          installNotes: data.installNotes ?? null,
          researchValueScore: data.researchValueScore ?? null,
          researchValueNotes: data.researchValueNotes ?? null,
        },
      },
    },
    include: itemInclude,
  });
}

export async function getItemById(id: string) {
  const { id: itemId } = itemIdSchema.parse({ id });

  return prisma.item.findUnique({
    where: {
      id: itemId,
    },
    include: itemInclude,
  });
}

export async function listItems(input: ListItemsInput = {}): Promise<ItemWithRelations[]> {
  const filters = listItemsSchema.parse(input);
  const where: Prisma.ItemWhereInput = {};
  const args: Prisma.ItemFindManyArgs = {
    where,
    take: filters.take,
    orderBy: {
      createdAt: "desc",
    },
    include: itemInclude,
  };

  if (filters.kind !== undefined) {
    where.kind = filters.kind;
  }

  if (filters.important !== undefined) {
    where.important = filters.important;
  }

  if (filters.archived !== undefined) {
    where.archived = filters.archived;
  }

  if (filters.cursor !== undefined) {
    args.cursor = {
      id: filters.cursor,
    };
    args.skip = 1;
  }

  return prisma.item.findMany(args) as Promise<ItemWithRelations[]>;
}

export async function updateItemStatus(input: UpdateItemStatusInput) {
  const status = updateItemStatusSchema.parse(input);
  const data: Prisma.ItemUpdateInput = {};

  if (status.important !== undefined) {
    data.important = status.important;
  }

  if (status.archived !== undefined) {
    data.archived = status.archived;
  }

  return prisma.item.update({
    where: {
      id: status.id,
    },
    data,
    include: itemInclude,
  });
}

export async function deleteItem(id: string) {
  const { id: itemId } = itemIdSchema.parse({ id });

  return prisma.item.delete({
    where: {
      id: itemId,
    },
    include: itemInclude,
  });
}
