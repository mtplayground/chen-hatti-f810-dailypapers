import { z } from "zod";

export const githubRepoFetchInputSchema = z.object({
  url: z.string().trim().min(1, "A GitHub repository URL is required."),
});

export type GitHubRepoFetchInput = z.input<typeof githubRepoFetchInputSchema>;
