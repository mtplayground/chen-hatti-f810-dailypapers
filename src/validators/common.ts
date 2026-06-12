import { z } from "zod";

export const idSchema = z.string().trim().min(1);
export const localeSchema = z.enum(["EN", "ZH"]);
export const itemKindSchema = z.enum(["PAPER", "REPOSITORY"]);
export const installDifficultySchema = z.enum(["UNKNOWN", "EASY", "MEDIUM", "HARD"]);

export const optionalTextSchema = z.string().trim().min(1).nullable().optional();
export const optionalUrlSchema = z.string().trim().url().nullable().optional();
export const scoreSchema = z.number().int().min(0).max(100).nullable().optional();

export const paginationSchema = z.object({
  cursor: idSchema.optional(),
  take: z.number().int().min(1).max(100).default(25),
});
