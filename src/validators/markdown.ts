import { z } from "zod";

export const markdownImportSchema = z.object({
  markdown: z.string().trim().min(1, "Markdown content is required.").max(1_000_000),
  important: z.boolean().optional(),
  autoSummarize: z.boolean().default(true),
});

export type MarkdownImportInput = z.input<typeof markdownImportSchema>;
