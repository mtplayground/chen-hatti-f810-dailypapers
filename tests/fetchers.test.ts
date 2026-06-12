import assert from "node:assert/strict";
import test from "node:test";

import { fetchArxivPaper, searchArxivPapersByKeywords } from "../src/fetchers/arxiv";
import { fetchGitHubRepository, searchGitHubTrendingRepositories } from "../src/fetchers/github";

function atomFeed(entries: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
    ${entries}
  </feed>`;
}

function arxivEntry(id: string, title: string): string {
  return `<entry>
    <id>http://arxiv.org/abs/${id}</id>
    <updated>2026-06-11T12:00:00Z</updated>
    <published>2026-06-10T09:30:00Z</published>
    <title>${title}</title>
    <summary>
      A compact abstract with enough detail for parsing.
    </summary>
    <author><name>Ada Lovelace</name></author>
    <author><name>Grace Hopper</name></author>
    <link href="https://arxiv.org/abs/${id}" rel="alternate" type="text/html"/>
    <link href="https://arxiv.org/pdf/${id}" title="pdf" type="application/pdf"/>
    <arxiv:primary_category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
    <category term="stat.ML" scheme="http://arxiv.org/schemas/atom"/>
    <arxiv:doi>10.48550/arXiv.${id.replace("v2", "")}</arxiv:doi>
    <arxiv:journal_ref>Daily Research 2026</arxiv:journal_ref>
  </entry>`;
}

void test("fetchArxivPaper parses arXiv Atom metadata", async () => {
  const seenUrls: string[] = [];
  const paper = await fetchArxivPaper("https://arxiv.org/abs/2606.01234v2", {
    fetcher: async (input) => {
      const url = new URL(String(input));
      seenUrls.push(url.toString());
      assert.equal(url.searchParams.get("id_list"), "2606.01234v2");

      return new Response(atomFeed(arxivEntry("2606.01234v2", "  Robust Agents  ")), {
        headers: { "content-type": "application/atom+xml" },
      });
    },
  });

  assert.equal(seenUrls.length, 1);
  assert.equal(paper.arxivId, "2606.01234");
  assert.equal(paper.version, "v2");
  assert.equal(paper.title, "Robust Agents");
  assert.deepEqual(paper.authors, ["Ada Lovelace", "Grace Hopper"]);
  assert.equal(paper.venue, "Daily Research 2026");
  assert.equal(paper.primaryCategory, "cs.LG");
  assert.deepEqual(paper.categories, ["cs.LG", "stat.ML"]);
  assert.equal(paper.landingUrl, "https://arxiv.org/abs/2606.01234v2");
  assert.equal(paper.pdfUrl, "https://arxiv.org/pdf/2606.01234v2");
  assert.equal(paper.canonicalUrl, "https://arxiv.org/abs/2606.01234");
  assert.equal(paper.publishedAt?.toISOString(), "2026-06-10T09:30:00.000Z");
});

void test("searchArxivPapersByKeywords builds a keyword query and deduplicates versions", async () => {
  const papers = await searchArxivPapersByKeywords(
    {
      keywords: ["agentic retrieval", "tool use"],
      maxResults: 10,
      submittedAfter: new Date("2026-06-01T00:00:00.000Z"),
    },
    {
      fetcher: async (input) => {
        const url = new URL(String(input));
        const searchQuery = url.searchParams.get("search_query") ?? "";
        assert.equal(url.searchParams.get("sortBy"), "submittedDate");
        assert.equal(url.searchParams.get("sortOrder"), "descending");
        assert.equal(url.searchParams.get("max_results"), "10");
        assert.match(searchQuery, /all:"agentic retrieval"/);
        assert.match(searchQuery, /all:"tool use"/);
        assert.match(searchQuery, /submittedDate:\[202606010000 TO 999912312359\]/);

        return new Response(
          atomFeed(
            `${arxivEntry("2606.00001v1", "First Version")}
             ${arxivEntry("2606.00001v2", "Second Version")}`,
          ),
        );
      },
    },
  );

  assert.equal(papers.length, 1);
  const paper = papers[0];
  assert.ok(paper);
  assert.equal(paper.arxivId, "2606.00001");
  assert.equal(paper.version, "v2");
});

void test("fetchGitHubRepository parses repository metadata and README content", async () => {
  const requests: string[] = [];
  const repository = await fetchGitHubRepository("https://github.com/openai/example", {
    token: "test-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      requests.push(url.pathname);
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers["Authorization"], "Bearer test-token");

      if (url.pathname === "/repos/openai/example/readme") {
        return Response.json({
          encoding: "base64",
          content: Buffer.from("# Example\n\nUseful project.", "utf8").toString("base64"),
        });
      }

      assert.equal(url.pathname, "/repos/openai/example");
      return Response.json({
        name: "example",
        full_name: "openai/example",
        html_url: "https://github.com/openai/example",
        owner: { login: "openai" },
        description: "A useful repository",
        stargazers_count: 1234,
        forks_count: 45,
        language: "TypeScript",
        updated_at: "2026-06-09T10:00:00Z",
        pushed_at: "2026-06-10T10:00:00Z",
        default_branch: "main",
        topics: ["ai", "agents"],
        license: { spdx_id: "MIT" },
      });
    },
  });

  assert.deepEqual(requests, ["/repos/openai/example", "/repos/openai/example/readme"]);
  assert.equal(repository.owner, "openai");
  assert.equal(repository.name, "example");
  assert.equal(repository.fullName, "openai/example");
  assert.equal(repository.readme, "# Example\n\nUseful project.");
  assert.deepEqual(repository.topics, ["ai", "agents"]);
  assert.equal(repository.stars, 1234);
  assert.equal(repository.license, "MIT");
  assert.equal(repository.canonicalUrl, "https://github.com/openai/example");
});

void test("searchGitHubTrendingRepositories builds topic and activity filters", async () => {
  const results = await searchGitHubTrendingRepositories(
    {
      keywords: ["agents"],
      topics: ["research"],
      maxResults: 5,
      minStars: 100,
      pushedAfter: new Date("2026-06-01T00:00:00.000Z"),
    },
    {
      fetcher: async (input) => {
        const url = new URL(String(input));
        const query = url.searchParams.get("q") ?? "";
        assert.equal(url.pathname, "/search/repositories");
        assert.equal(url.searchParams.get("sort"), "stars");
        assert.equal(url.searchParams.get("per_page"), "5");
        assert.match(query, /agents/);
        assert.match(query, /topic:research/);
        assert.match(query, /stars:>=100/);
        assert.match(query, /pushed:>=2026-06-01/);
        assert.match(query, /archived:false/);

        return Response.json({
          items: [
            {
              name: "agent-kit",
              full_name: "openai/agent-kit",
              html_url: "https://github.com/openai/agent-kit",
              owner: { login: "openai" },
              description: "Agent tooling",
              stargazers_count: 900,
              forks_count: 33,
              language: "TypeScript",
              updated_at: "2026-06-11T00:00:00Z",
              pushed_at: "2026-06-11T02:00:00Z",
              topics: ["research"],
            },
          ],
        });
      },
    },
  );

  assert.equal(results.length, 1);
  const result = results[0];
  assert.ok(result);
  assert.equal(result.fullName, "openai/agent-kit");
  assert.equal(result.canonicalUrl, "https://github.com/openai/agent-kit");
  assert.equal(result.stars, 900);
});
