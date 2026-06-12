import { z } from "zod";

export const arxivFetchInputSchema = z.object({
  url: z.string().trim().min(1, "An arXiv URL or identifier is required."),
});

export type ArxivFetchInput = z.input<typeof arxivFetchInputSchema>;
