import { z } from "zod";

import { idSchema } from "@/validators/common";

export const summarizePaperSchema = z.object({
  itemId: idSchema,
});

export type SummarizePaperInput = z.input<typeof summarizePaperSchema>;
