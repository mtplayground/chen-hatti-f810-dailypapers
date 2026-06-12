import { z } from "zod";

import { idSchema, localeSchema, optionalTextSchema } from "@/validators/common";

export const upsertNoteSchema = z.object({
  itemId: idSchema,
  language: localeSchema,
  title: optionalTextSchema,
  content: z.string().trim().min(1),
});

export const listNotesSchema = z.object({
  itemId: idSchema,
  language: localeSchema.optional(),
});

export const deleteNoteSchema = z.object({
  itemId: idSchema,
  language: localeSchema,
});

export type UpsertNoteInput = z.input<typeof upsertNoteSchema>;
export type ListNotesInput = z.input<typeof listNotesSchema>;
export type DeleteNoteInput = z.input<typeof deleteNoteSchema>;
