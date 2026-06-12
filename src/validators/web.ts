import { z } from "zod";

export const genericMetadataFetchInputSchema = z.object({
  url: z.string().trim().url("A valid web or PDF URL is required."),
});

export type GenericMetadataFetchInput = z.input<typeof genericMetadataFetchInputSchema>;
