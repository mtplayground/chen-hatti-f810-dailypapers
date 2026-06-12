import { z } from "zod";

import { itemKindSchema } from "@/validators/common";

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.");

const optionalSearchTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .optional()
  .transform((value) => (value === "" ? undefined : value));

function csvList(value: unknown): string[] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const values = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return values.length > 0 ? [...new Set(values)] : undefined;
}

export const searchItemsSchema = z
  .object({
    q: optionalSearchTextSchema,
    type: itemKindSchema.optional(),
    date: dateStringSchema.optional(),
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
    topic: z.preprocess(csvList, z.array(z.string().trim().min(1).max(80)).max(20).optional()),
    minRelevance: z.coerce.number().int().min(0).max(100).optional(),
    maxRelevance: z.coerce.number().int().min(0).max(100).optional(),
    take: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine(
    (value) =>
      value.minRelevance === undefined ||
      value.maxRelevance === undefined ||
      value.minRelevance <= value.maxRelevance,
    {
      message: "minRelevance must be less than or equal to maxRelevance.",
      path: ["minRelevance"],
    },
  );

export type SearchItemsInput = z.input<typeof searchItemsSchema>;
export type SearchItemsData = z.output<typeof searchItemsSchema>;
