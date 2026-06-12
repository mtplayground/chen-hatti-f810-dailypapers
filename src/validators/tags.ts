import { z } from "zod";

import { idSchema, optionalTextSchema } from "@/validators/common";

const tagFieldsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameEn: z.string().trim().min(1),
  nameZh: optionalTextSchema,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export const createTagSchema = tagFieldsSchema;

export const updateTagSchema = tagFieldsSchema
  .partial()
  .extend({
    id: idSchema,
  })
  .refine(
    (value) =>
      value.slug !== undefined ||
      value.nameEn !== undefined ||
      value.nameZh !== undefined ||
      value.color !== undefined,
    {
      message: "At least one tag field is required.",
    },
  );

export const deleteTagSchema = z.object({
  id: idSchema,
});

export const setItemTagsSchema = z.object({
  itemId: idSchema,
  tagIds: z.array(idSchema).default([]),
});

export type CreateTagInput = z.input<typeof createTagSchema>;
export type UpdateTagInput = z.input<typeof updateTagSchema>;
export type SetItemTagsInput = z.input<typeof setItemTagsSchema>;
