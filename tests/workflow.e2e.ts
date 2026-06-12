import assert from "node:assert/strict";
import test from "node:test";

import { ItemKind, Locale } from "@prisma/client";

import { prisma } from "../src/lib/prisma";
import { ingestBatchUrls, type BatchIngestUrlResult } from "../src/services/ingestion";
import { exportMarkdownForDay } from "../src/services/markdown-export";
import { listNotes, upsertNote } from "../src/services/notes";
import { createTag, setItemTags } from "../src/services/tags";

const PAPER_URL = "https://arxiv.org/abs/9912.33001v1";
const PAPER_CANONICAL_URL = "https://arxiv.org/abs/9912.33001";
const REPOSITORY_URL = "https://github.com/mctai/e2e-repo-issue-33";
const TAG_SLUG = "issue-33-workflow";
const TEST_CANONICAL_URLS = [PAPER_CANONICAL_URL, REPOSITORY_URL];

type SuccessfulBatchResult = Extract<BatchIngestUrlResult, { ok: true }>;

type ChatCompletionRequest = {
  messages?: Array<{
    role?: string;
    content?: string;
  }>;
};

void test("example workflow ingests pasted URLs, summarizes, edits notes/tags, and exports Markdown", async () => {
  process.env["LLM_API_KEY"] = "e2e-test-key";
  process.env["GITHUB_TOKEN"] = "e2e-test-token";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockWorkflowFetch;

  try {
    await cleanupWorkflowRows();

    const ingested = await ingestBatchUrls({
      urls: `${PAPER_URL}\n${REPOSITORY_URL}`,
      important: true,
      autoSummarize: true,
    });

    const successfulResults = ingested.results.filter(isSuccessfulBatchResult);
    assert.equal(successfulResults.length, 2);
    assert.deepEqual(successfulResults.map((result) => result.source).sort(), ["ARXIV", "GITHUB"]);
    assert.ok(successfulResults.every((result) => result.summary?.ok === true));

    const paperResult = successfulResults.find((result) => result.source === "ARXIV");
    const repositoryResult = successfulResults.find((result) => result.source === "GITHUB");
    assert.ok(paperResult);
    assert.ok(repositoryResult);
    assert.equal(paperResult.item.kind, ItemKind.PAPER);
    assert.equal(repositoryResult.item.kind, ItemKind.REPOSITORY);

    await upsertNote({
      itemId: paperResult.item.id,
      language: Locale.EN,
      title: "Initial workflow note",
      content: "Initial note captured after summary.",
    });
    await upsertNote({
      itemId: paperResult.item.id,
      language: Locale.EN,
      title: "Updated workflow note",
      content: "Updated note captured after review.",
    });

    const tag = await createTag({
      slug: TAG_SLUG,
      nameEn: "Issue 33 Workflow",
      color: "#2563eb",
    });
    await setItemTags({ itemId: paperResult.item.id, tagIds: [tag.id] });
    await setItemTags({ itemId: repositoryResult.item.id, tagIds: [tag.id] });

    const notes = await listNotes({ itemId: paperResult.item.id, language: Locale.EN });
    assert.equal(notes.length, 1);
    const note = notes[0];
    assert.ok(note);
    assert.equal(note.title, "Updated workflow note");
    assert.equal(note.content, "Updated note captured after review.");

    const exportDate = new Date().toISOString().slice(0, 10);
    const exported = await exportMarkdownForDay({ date: exportDate, language: "EN" });

    assert.equal(exported.filename, `daily-papers-${exportDate}.md`);
    assert.match(exported.markdown, new RegExp(`# Daily Papers - ${exportDate}`));
    assert.match(exported.markdown, /## Papers/);
    assert.match(exported.markdown, /End-to-End Paper/);
    assert.match(exported.markdown, /Paper summary for issue 33 workflow\./);
    assert.match(exported.markdown, /Issue 33 Workflow/);
    assert.match(exported.markdown, /## GitHub Repositories/);
    assert.match(exported.markdown, /mctai\/e2e-repo-issue-33/);
    assert.match(exported.markdown, /Repository summary for issue 33 workflow\./);
  } finally {
    globalThis.fetch = originalFetch;
    await cleanupWorkflowRows();
  }
});

function isSuccessfulBatchResult(result: BatchIngestUrlResult): result is SuccessfulBatchResult {
  return result.ok;
}

async function cleanupWorkflowRows(): Promise<void> {
  await prisma.item.deleteMany({
    where: {
      canonicalUrl: {
        in: TEST_CANONICAL_URLS,
      },
    },
  });
  await prisma.tag.deleteMany({
    where: {
      slug: TAG_SLUG,
    },
  });
}

async function mockWorkflowFetch(input: string | URL | Request, init?: RequestInit) {
  const url = requestUrl(input);

  if (url.hostname === "export.arxiv.org") {
    return new Response(arxivResponseXml(), {
      headers: { "content-type": "application/atom+xml" },
    });
  }

  if (url.hostname === "api.github.com") {
    return githubResponse(url, init);
  }

  if (url.pathname === "/v1/chat/completions") {
    return llmResponse(init);
  }

  throw new Error(`Unexpected workflow E2E fetch: ${url.toString()}`);
}

function requestUrl(input: string | URL | Request): URL {
  if (typeof input === "string" || input instanceof URL) {
    return new URL(String(input));
  }

  return new URL(input.url);
}

function arxivResponseXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
    <entry>
      <id>${PAPER_URL}</id>
      <updated>2026-06-11T12:00:00Z</updated>
      <published>2026-06-10T09:30:00Z</published>
      <title>End-to-End Paper</title>
      <summary>A paper used to verify the paste fetch summarize export workflow.</summary>
      <author><name>Ada Lovelace</name></author>
      <author><name>Grace Hopper</name></author>
      <link href="${PAPER_URL}" rel="alternate" type="text/html"/>
      <link href="https://arxiv.org/pdf/9912.33001v1" title="pdf" type="application/pdf"/>
      <arxiv:primary_category term="cs.SE" scheme="http://arxiv.org/schemas/atom"/>
      <category term="cs.SE" scheme="http://arxiv.org/schemas/atom"/>
      <arxiv:doi>10.48550/arXiv.9912.33001</arxiv:doi>
      <arxiv:journal_ref>Workflow E2E 2026</arxiv:journal_ref>
    </entry>
  </feed>`;
}

function githubResponse(url: URL, init: RequestInit | undefined): Response {
  const headers = init?.headers as Record<string, string> | undefined;
  assert.equal(headers?.["Authorization"], "Bearer e2e-test-token");

  if (url.pathname === "/repos/mctai/e2e-repo-issue-33/readme") {
    return Response.json({
      encoding: "base64",
      content: Buffer.from("# E2E Repo\n\nA repository for workflow testing.", "utf8").toString(
        "base64",
      ),
    });
  }

  assert.equal(url.pathname, "/repos/mctai/e2e-repo-issue-33");
  return Response.json({
    name: "e2e-repo-issue-33",
    full_name: "mctai/e2e-repo-issue-33",
    html_url: REPOSITORY_URL,
    owner: { login: "mctai" },
    description: "Repository used by the issue 33 workflow test.",
    stargazers_count: 333,
    forks_count: 12,
    language: "TypeScript",
    updated_at: "2026-06-11T10:00:00Z",
    pushed_at: "2026-06-11T12:00:00Z",
    default_branch: "main",
    topics: ["workflow", "testing"],
    license: { spdx_id: "MIT" },
  });
}

function llmResponse(init: RequestInit | undefined): Response {
  const request = parseChatCompletionRequest(init);
  const systemPrompt =
    request.messages?.find((message) => message.role === "system")?.content ?? "";
  const userPrompt = request.messages?.find((message) => message.role === "user")?.content ?? "";
  const isChinese = systemPrompt.includes("simplified Chinese");
  const content = userPrompt.includes("Analyze this repository.")
    ? repositoryAnalysisJson(isChinese)
    : paperAnalysisJson(isChinese);

  return Response.json({
    choices: [
      {
        message: {
          content: JSON.stringify(content),
        },
      },
    ],
  });
}

function parseChatCompletionRequest(init: RequestInit | undefined): ChatCompletionRequest {
  if (typeof init?.body !== "string") {
    throw new Error("Expected LLM request body to be a JSON string.");
  }

  return JSON.parse(init.body) as ChatCompletionRequest;
}

function paperAnalysisJson(isChinese: boolean) {
  return {
    headline: isChinese ? "端到端论文" : "End-to-end paper",
    summary: isChinese ? "用于验证工作流的论文摘要。" : "Paper summary for issue 33 workflow.",
    keyPoints: isChinese
      ? ["验证粘贴流程", "验证导出格式"]
      : ["Verifies pasted URL ingestion", "Verifies Markdown export"],
    problem: isChinese ? "工作流需要覆盖。" : "The workflow needs coverage.",
    coreIdea: isChinese ? "使用固定元数据。" : "Use fixed metadata.",
    methodDesign: isChinese ? "模拟外部服务。" : "Mock external services.",
    experiments: isChinese ? "运行端到端测试。" : "Run an end-to-end test.",
    strengths: isChinese ? ["稳定"] : ["Stable"],
    weaknesses: isChinese ? ["范围有限"] : ["Narrow scope"],
    relevance: {
      score: 92,
      notes: isChinese ? "适合测试。" : "Relevant to the workflow test.",
    },
  };
}

function repositoryAnalysisJson(isChinese: boolean) {
  return {
    headline: isChinese ? "端到端仓库" : "End-to-end repository",
    summary: isChinese ? "用于验证工作流的仓库摘要。" : "Repository summary for issue 33 workflow.",
    keyPoints: isChinese
      ? ["验证 GitHub 获取", "验证 Markdown 导出"]
      : ["Verifies GitHub fetch", "Verifies Markdown export"],
    whatItDoes: isChinese ? "验证流程。" : "Verifies the workflow.",
    problemSolved: isChinese ? "覆盖端到端路径。" : "Covers the end-to-end path.",
    techStack: ["TypeScript"],
    usage: isChinese ? "作为测试夹具使用。" : "Used as a test fixture.",
    usefulness: {
      score: 89,
      notes: isChinese ? "适合自动测试。" : "Useful for automated workflow testing.",
    },
    limitations: isChinese ? ["不是生产仓库"] : ["Not a production repository"],
    installDifficulty: "EASY",
  };
}
