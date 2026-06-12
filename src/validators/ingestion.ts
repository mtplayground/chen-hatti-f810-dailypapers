import { z } from "zod";

const ingestUrlSchema = z.string().trim().url();

export const ingestSingleUrlSchema = z.object({
  url: ingestUrlSchema,
  important: z.boolean().optional(),
});

export const ingestBatchUrlsSchema = z
  .object({
    urls: z.union([ingestUrlSchema, z.array(ingestUrlSchema).min(1).max(50)]),
    important: z.boolean().optional(),
  })
  .transform((value) => ({
    ...value,
    urls:
      typeof value.urls === "string"
        ? splitPastedUrls(value.urls)
        : [...new Set(value.urls.map((url) => url.trim()))],
  }))
  .refine((value) => value.urls.length > 0, {
    message: "At least one URL is required.",
    path: ["urls"],
  })
  .refine((value) => value.urls.length <= 50, {
    message: "At most 50 URLs can be ingested at once.",
    path: ["urls"],
  });

export type IngestSingleUrlInput = z.input<typeof ingestSingleUrlSchema>;
export type IngestBatchUrlsInput = z.input<typeof ingestBatchUrlsSchema>;
export type IngestSingleUrlData = z.output<typeof ingestSingleUrlSchema>;
export type IngestBatchUrlsData = z.output<typeof ingestBatchUrlsSchema>;

function splitPastedUrls(value: string): string[] {
  const urls = value
    .split(/[\s,]+/)
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  return [...new Set(urls)];
}
