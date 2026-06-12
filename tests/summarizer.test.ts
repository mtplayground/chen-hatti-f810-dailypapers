import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzePaperWithLlm,
  analyzeRepositoryWithLlm,
  buildPaperAnalysisPrompt,
  buildRepositoryAnalysisPrompt,
  type LlmClient,
  type LlmPrompt,
} from "../src/services/llm";
import type { PaperAnalysisResult, RepositoryAnalysisResult } from "../src/validators/llm";

void test("buildPaperAnalysisPrompt includes normalized paper metadata", () => {
  const prompt = buildPaperAnalysisPrompt({
    title: "Memory-Augmented Agents",
    authors: ["Ada Lovelace", "Grace Hopper"],
    venue: "arXiv",
    publishedAt: new Date("2026-06-10T00:00:00.000Z"),
    revisedAt: null,
    landingUrl: "https://arxiv.org/abs/2606.01234",
    pdfUrl: "https://arxiv.org/pdf/2606.01234",
    abstract: "A paper about durable agent memory.",
    language: "EN",
  });

  assert.equal(prompt.responseSchemaName, "PaperAnalysisResult");
  assert.equal(prompt.version, "analysis-v1");
  assert.match(prompt.messages[0]?.content ?? "", /concise professional English/);
  assert.match(prompt.messages[1]?.content ?? "", /Title: Memory-Augmented Agents/);
  assert.match(prompt.messages[1]?.content ?? "", /Authors: Ada Lovelace, Grace Hopper/);
  assert.match(prompt.messages[1]?.content ?? "", /Abstract:\nA paper about durable agent memory/);
});

void test("analyzePaperWithLlm delegates to the client with the paper schema prompt", async () => {
  const result: PaperAnalysisResult = {
    headline: "Durable memory for agents",
    summary: "The paper studies memory systems for agent workflows.",
    keyPoints: ["Builds memory abstractions", "Evaluates agent recall"],
    problem: "Agents lose useful context.",
    coreIdea: "Store and retrieve structured memory.",
    methodDesign: "A retrieval-backed memory layer.",
    experiments: "Benchmarks on agent tasks.",
    strengths: ["Clear design"],
    weaknesses: ["Limited baselines"],
    relevance: { score: 88, notes: "Directly relevant to research tooling." },
  };
  const prompts: LlmPrompt[] = [];
  const client = {
    completeJson: async (prompt: LlmPrompt) => {
      prompts.push(prompt);
      return result;
    },
  } as unknown as LlmClient;

  const analyzed = await analyzePaperWithLlm(
    {
      title: "Memory-Augmented Agents",
      authors: ["Ada Lovelace"],
      abstract: "A paper about durable agent memory.",
      language: "EN",
    },
    client,
  );

  assert.equal(analyzed, result);
  assert.equal(prompts.length, 1);
  const prompt = prompts[0];
  assert.ok(prompt);
  assert.equal(prompt.responseSchemaName, "PaperAnalysisResult");
  assert.match(prompt.messages[1]?.content ?? "", /Memory-Augmented Agents/);
});

void test("buildRepositoryAnalysisPrompt includes README and repository metadata", () => {
  const prompt = buildRepositoryAnalysisPrompt({
    owner: "openai",
    name: "agent-kit",
    url: "https://github.com/openai/agent-kit",
    description: "Agent tooling",
    stars: 900,
    forks: 33,
    primaryLanguage: "TypeScript",
    lastUpdatedAt: new Date("2026-06-11T00:00:00.000Z"),
    readme: "# Agent Kit\n\nInstall and run agent workflows.",
    language: "ZH",
  });

  assert.equal(prompt.responseSchemaName, "RepositoryAnalysisResult");
  assert.match(prompt.messages[0]?.content ?? "", /simplified Chinese/);
  assert.match(prompt.messages[1]?.content ?? "", /Name: openai\/agent-kit/);
  assert.match(prompt.messages[1]?.content ?? "", /Stars: 900/);
  assert.match(prompt.messages[1]?.content ?? "", /README:\n# Agent Kit/);
});

void test("analyzeRepositoryWithLlm delegates to the client with the repository schema prompt", async () => {
  const result: RepositoryAnalysisResult = {
    headline: "Agent workflow toolkit",
    summary: "The repository packages reusable agent workflow utilities.",
    keyPoints: ["Provides orchestration helpers", "Documents setup"],
    whatItDoes: "Builds agent workflows.",
    problemSolved: "Reduces orchestration boilerplate.",
    techStack: ["TypeScript"],
    usage: "Install from npm and configure workflows.",
    usefulness: { score: 91, notes: "Useful for daily research automation." },
    limitations: ["Early project"],
    installDifficulty: "EASY",
  };
  const prompts: LlmPrompt[] = [];
  const client = {
    completeJson: async (prompt: LlmPrompt) => {
      prompts.push(prompt);
      return result;
    },
  } as unknown as LlmClient;

  const analyzed = await analyzeRepositoryWithLlm(
    {
      owner: "openai",
      name: "agent-kit",
      url: "https://github.com/openai/agent-kit",
      stars: 900,
      forks: 33,
      readme: "# Agent Kit",
      language: "EN",
    },
    client,
  );

  assert.equal(analyzed, result);
  assert.equal(prompts.length, 1);
  const prompt = prompts[0];
  assert.ok(prompt);
  assert.equal(prompt.responseSchemaName, "RepositoryAnalysisResult");
  assert.match(prompt.messages[1]?.content ?? "", /Name: openai\/agent-kit/);
});
