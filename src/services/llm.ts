import { z } from "zod";

import { getOptionalEnv, getRequiredEnv } from "@/lib/env";
import {
  paperAnalysisPromptInputSchema,
  paperAnalysisResultSchema,
  repositoryAnalysisPromptInputSchema,
  repositoryAnalysisResultSchema,
  type PaperAnalysisPromptInput,
  type PaperAnalysisResult,
  type RepositoryAnalysisPromptInput,
  type RepositoryAnalysisResult,
} from "@/validators/llm";

const DEFAULT_LLM_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_LLM_MODEL = "gpt-4o-mini";
const DEFAULT_LLM_TIMEOUT_MS = 30_000;
const DEFAULT_LLM_TEMPERATURE = 0.2;
const PROMPT_VERSION = "analysis-v1";

type ChatRole = "system" | "user";

export type LlmMessage = {
  role: ChatRole;
  content: string;
};

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  timeoutMs: number;
};

export type LlmPrompt = {
  version: string;
  responseSchemaName: string;
  messages: LlmMessage[];
};

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}

export class LlmClientError extends Error {
  constructor(
    message: string,
    readonly code: "HTTP_ERROR" | "INVALID_RESPONSE" | "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "LlmClientError";
  }
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export function getLlmConfig(): LlmConfig {
  return {
    apiKey: getRequiredEnv("LLM_API_KEY"),
    baseUrl: normalizeBaseUrl(getOptionalEnv("LLM_BASE_URL") ?? DEFAULT_LLM_BASE_URL),
    model: getOptionalEnv("LLM_MODEL") ?? DEFAULT_LLM_MODEL,
    temperature: parseOptionalNumber(
      getOptionalEnv("LLM_TEMPERATURE"),
      DEFAULT_LLM_TEMPERATURE,
      "LLM_TEMPERATURE",
    ),
    timeoutMs: parseOptionalInteger(
      getOptionalEnv("LLM_TIMEOUT_MS"),
      DEFAULT_LLM_TIMEOUT_MS,
      "LLM_TIMEOUT_MS",
    ),
  };
}

export class LlmClient {
  constructor(private readonly config: LlmConfig = getLlmConfig()) {}

  async completeJson<T>(prompt: LlmPrompt, schema: z.ZodType<T>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: this.config.temperature,
          response_format: { type: "json_object" },
          messages: prompt.messages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new LlmClientError(
          `LLM request failed with ${response.status}: ${trimForError(body)}`,
          "HTTP_ERROR",
        );
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;

      if (content === undefined || content === null || content.trim() === "") {
        throw new LlmClientError(
          "LLM response did not include message content.",
          "INVALID_RESPONSE",
        );
      }

      let parsedContent: unknown;

      try {
        parsedContent = parseJsonContent(content);
      } catch (error) {
        throw new LlmClientError(
          `LLM response was not valid JSON: ${
            error instanceof Error ? error.message : "Unknown JSON parse error."
          }`,
          "INVALID_RESPONSE",
        );
      }

      return schema.parse(parsedContent);
    } catch (error) {
      if (error instanceof LlmClientError) {
        throw error;
      }

      if (error instanceof z.ZodError) {
        throw new LlmClientError(
          `LLM response failed validation: ${error.message}`,
          "INVALID_RESPONSE",
        );
      }

      throw new LlmClientError(
        error instanceof Error ? error.message : "Unknown LLM request failure.",
        "REQUEST_FAILED",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createLlmClient(config: LlmConfig = getLlmConfig()): LlmClient {
  return new LlmClient(config);
}

export function buildPaperAnalysisPrompt(input: PaperAnalysisPromptInput): LlmPrompt {
  const data = paperAnalysisPromptInputSchema.parse(input);
  const languageInstruction =
    data.language === "ZH"
      ? "Write the analysis in simplified Chinese."
      : "Write the analysis in concise professional English.";

  return {
    version: PROMPT_VERSION,
    responseSchemaName: "PaperAnalysisResult",
    messages: [
      {
        role: "system",
        content: [
          "You analyze research papers for a daily research dashboard.",
          languageInstruction,
          "Return only valid JSON with exactly these keys: headline, summary, keyPoints, problem, coreIdea, methodDesign, experiments, strengths, weaknesses, relevance.",
          "Use headline as a short dashboard title, summary as a one-paragraph executive summary, and keyPoints as 3 to 6 concise bullets.",
          "Use relevance.score as an integer from 0 to 100 or null when there is not enough evidence.",
          "Do not invent experiments, venues, or claims that are not supported by the provided metadata.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Analyze this paper.",
          `Title: ${data.title}`,
          `Authors: ${data.authors.length > 0 ? data.authors.join(", ") : "Unknown"}`,
          `Venue: ${data.venue ?? "Unknown"}`,
          `Published: ${formatDate(data.publishedAt)}`,
          `Revised: ${formatDate(data.revisedAt)}`,
          `Landing URL: ${data.landingUrl ?? "None"}`,
          `PDF URL: ${data.pdfUrl ?? "None"}`,
          `Abstract:\n${data.abstract}`,
        ].join("\n\n"),
      },
    ],
  };
}

export function buildRepositoryAnalysisPrompt(input: RepositoryAnalysisPromptInput): LlmPrompt {
  const data = repositoryAnalysisPromptInputSchema.parse(input);
  const languageInstruction =
    data.language === "ZH"
      ? "Write the analysis in simplified Chinese."
      : "Write the analysis in concise professional English.";

  return {
    version: PROMPT_VERSION,
    responseSchemaName: "RepositoryAnalysisResult",
    messages: [
      {
        role: "system",
        content: [
          "You analyze GitHub repositories for a daily research dashboard.",
          languageInstruction,
          "Return only valid JSON with exactly these keys: whatItDoes, problemSolved, techStack, usage, usefulness, limitations, installDifficulty.",
          "Use usefulness.score as an integer from 0 to 100 or null when there is not enough evidence.",
          "Set installDifficulty to UNKNOWN, EASY, MEDIUM, or HARD.",
          "Do not invent setup steps, dependencies, or capabilities that are not supported by the provided metadata.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Analyze this repository.",
          `Name: ${data.owner}/${data.name}`,
          `URL: ${data.url}`,
          `Description: ${data.description ?? "None"}`,
          `Stars: ${data.stars}`,
          `Forks: ${data.forks}`,
          `Primary language: ${data.primaryLanguage ?? "Unknown"}`,
          `Last updated: ${formatDate(data.lastUpdatedAt)}`,
          `README:\n${truncateForPrompt(data.readme ?? "No README content provided.")}`,
        ].join("\n\n"),
      },
    ],
  };
}

export async function analyzePaperWithLlm(
  input: PaperAnalysisPromptInput,
  client: LlmClient = createLlmClient(),
): Promise<PaperAnalysisResult> {
  return client.completeJson(buildPaperAnalysisPrompt(input), paperAnalysisResultSchema);
}

export async function analyzeRepositoryWithLlm(
  input: RepositoryAnalysisPromptInput,
  client: LlmClient = createLlmClient(),
): Promise<RepositoryAnalysisResult> {
  return client.completeJson(buildRepositoryAnalysisPrompt(input), repositoryAnalysisResultSchema);
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (trimmed === "") {
    throw new LlmConfigError("LLM_BASE_URL cannot be empty.");
  }

  return trimmed;
}

function parseOptionalNumber(value: string | undefined, fallback: number, key: string): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new LlmConfigError(`${key} must be a finite number.`);
  }

  if (parsed < 0 || parsed > 2) {
    throw new LlmConfigError(`${key} must be between 0 and 2.`);
  }

  return parsed;
}

function parseOptionalInteger(value: string | undefined, fallback: number, key: string): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new LlmConfigError(`${key} must be a positive integer.`);
  }

  return parsed;
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(withoutFence) as unknown;
}

function formatDate(date: Date | null | undefined): string {
  return date === undefined || date === null ? "Unknown" : date.toISOString();
}

function trimForError(value: string): string {
  return value.trim().slice(0, 1_000) || "No response body.";
}

function truncateForPrompt(value: string): string {
  return value.length <= 20_000 ? value : `${value.slice(0, 20_000)}\n\n[README truncated]`;
}
