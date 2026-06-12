import { z } from "zod";

export const huggingFaceDailyPapersFetchInputSchema = z.object({
  maxResults: z.number().int().min(1).max(100).default(50),
});

export type HuggingFaceDailyPapersFetchInput = z.input<
  typeof huggingFaceDailyPapersFetchInputSchema
>;
export type HuggingFaceDailyPapersFetchData = z.output<
  typeof huggingFaceDailyPapersFetchInputSchema
>;
