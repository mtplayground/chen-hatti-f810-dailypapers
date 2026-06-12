import { z } from "zod";

import { installDifficultySchema, optionalTextSchema, scoreSchema } from "@/validators/common";

const titleSchema = z.string().trim().min(1);
const textSchema = z.string().trim().min(1);
const urlSchema = z.string().trim().url();

export const llmLanguageSchema = z.enum(["EN", "ZH"]);

export const paperAnalysisPromptInputSchema = z.object({
  title: titleSchema,
  authors: z.array(textSchema).default([]),
  venue: optionalTextSchema,
  publishedAt: z.coerce.date().nullable().optional(),
  revisedAt: z.coerce.date().nullable().optional(),
  landingUrl: urlSchema.nullable().optional(),
  pdfUrl: urlSchema.nullable().optional(),
  abstract: textSchema,
  language: llmLanguageSchema.default("EN"),
});

export const repositoryAnalysisPromptInputSchema = z.object({
  name: titleSchema,
  owner: textSchema,
  url: urlSchema,
  description: optionalTextSchema,
  stars: z.number().int().min(0).default(0),
  forks: z.number().int().min(0).default(0),
  primaryLanguage: optionalTextSchema,
  lastUpdatedAt: z.coerce.date().nullable().optional(),
  readme: optionalTextSchema,
  language: llmLanguageSchema.default("EN"),
});

export const paperAnalysisResultSchema = z.object({
  problem: textSchema,
  coreIdea: textSchema,
  methodDesign: textSchema,
  experiments: textSchema,
  strengths: z.array(textSchema).min(1),
  weaknesses: z.array(textSchema).min(1),
  relevance: z.object({
    score: scoreSchema.unwrap().nullable(),
    notes: textSchema,
  }),
});

export const repositoryAnalysisResultSchema = z.object({
  whatItDoes: textSchema,
  problemSolved: textSchema,
  techStack: z.array(textSchema),
  usage: textSchema,
  usefulness: z.object({
    score: scoreSchema.unwrap().nullable(),
    notes: textSchema,
  }),
  limitations: z.array(textSchema).min(1),
  installDifficulty: installDifficultySchema,
});

export type LlmLanguage = z.infer<typeof llmLanguageSchema>;
export type PaperAnalysisPromptInput = z.input<typeof paperAnalysisPromptInputSchema>;
export type RepositoryAnalysisPromptInput = z.input<typeof repositoryAnalysisPromptInputSchema>;
export type PaperAnalysisResult = z.infer<typeof paperAnalysisResultSchema>;
export type RepositoryAnalysisResult = z.infer<typeof repositoryAnalysisResultSchema>;
