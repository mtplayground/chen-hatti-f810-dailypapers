import { z } from "zod";

import {
  idSchema,
  installDifficultySchema,
  itemKindSchema,
  optionalTextSchema,
  optionalUrlSchema,
  paginationSchema,
  scoreSchema,
} from "@/validators/common";

const itemStatusFieldsSchema = z.object({
  important: z.boolean().optional(),
  archived: z.boolean().optional(),
});

const itemSourceFieldsSchema = z.object({
  sourceUrl: optionalUrlSchema,
  canonicalUrl: optionalUrlSchema,
});

export const createPaperItemSchema = itemSourceFieldsSchema.merge(itemStatusFieldsSchema).extend({
  title: z.string().trim().min(1),
  authors: z.array(z.string().trim().min(1)).default([]),
  venue: optionalTextSchema,
  publishedAt: z.coerce.date().nullable().optional(),
  revisedAt: z.coerce.date().nullable().optional(),
  arxivId: optionalTextSchema,
  doi: optionalTextSchema,
  landingUrl: optionalUrlSchema,
  pdfUrl: optionalUrlSchema,
  abstract: optionalTextSchema,
  problemStatement: optionalTextSchema,
  methodology: optionalTextSchema,
  keyFindings: optionalTextSchema,
  limitations: optionalTextSchema,
  analysis: z.json().nullable().optional(),
  relevanceScore: scoreSchema,
  relevanceNotes: optionalTextSchema,
});

export const createRepositoryItemSchema = itemSourceFieldsSchema
  .merge(itemStatusFieldsSchema)
  .extend({
    name: z.string().trim().min(1),
    url: z.string().trim().url(),
    owner: z.string().trim().min(1),
    description: optionalTextSchema,
    stars: z.number().int().min(0).default(0),
    forks: z.number().int().min(0).default(0),
    primaryLanguage: optionalTextSchema,
    lastUpdatedAt: z.coerce.date().nullable().optional(),
    readme: optionalTextSchema,
    techStack: z.array(z.string().trim().min(1)).default([]),
    installDifficulty: installDifficultySchema.default("UNKNOWN"),
    installNotes: optionalTextSchema,
    researchValueScore: scoreSchema,
    researchValueNotes: optionalTextSchema,
  });

export const listItemsSchema = paginationSchema.extend({
  kind: itemKindSchema.optional(),
  important: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const updateItemStatusSchema = itemStatusFieldsSchema
  .extend({
    id: idSchema,
  })
  .refine((value) => value.important !== undefined || value.archived !== undefined, {
    message: "At least one status field is required.",
  });

export const itemIdSchema = z.object({
  id: idSchema,
});

export type CreatePaperItemInput = z.input<typeof createPaperItemSchema>;
export type CreateRepositoryItemInput = z.input<typeof createRepositoryItemSchema>;
export type ListItemsInput = z.input<typeof listItemsSchema>;
export type UpdateItemStatusInput = z.input<typeof updateItemStatusSchema>;
