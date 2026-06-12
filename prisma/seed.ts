import { InstallDifficulty, ItemKind, Locale, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SummarySeed = {
  language: Locale;
  headline: string;
  summary: string;
  keyPoints: string[];
};

type TagSeed = {
  slug: string;
  nameEn: string;
  nameZh: string;
  color: string;
};

type PaperSeed = {
  canonicalUrl: string;
  sourceUrl: string;
  tags: string[];
  paper: {
    title: string;
    authors: string[];
    venue: string;
    publishedAt: Date;
    revisedAt: Date | null;
    arxivId: string;
    doi: string | null;
    landingUrl: string;
    pdfUrl: string;
    abstract: string;
    problemStatement: string;
    methodology: string;
    keyFindings: string;
    limitations: string;
    analysis: Record<string, string>;
    relevanceScore: number;
    relevanceNotes: string;
  };
  summaries: SummarySeed[];
};

type RepositorySeed = {
  canonicalUrl: string;
  sourceUrl: string;
  tags: string[];
  repository: {
    name: string;
    url: string;
    owner: string;
    description: string;
    stars: number;
    forks: number;
    primaryLanguage: string;
    lastUpdatedAt: Date;
    readme: string;
    techStack: string[];
    installDifficulty: InstallDifficulty;
    installNotes: string;
    researchValueScore: number;
    researchValueNotes: string;
  };
  summaries: SummarySeed[];
};

const tagSeeds: TagSeed[] = [
  {
    slug: "llm",
    nameEn: "LLM",
    nameZh: "大语言模型",
    color: "#2f6f5e",
  },
  {
    slug: "retrieval",
    nameEn: "Retrieval",
    nameZh: "检索增强",
    color: "#4f6fb7",
  },
  {
    slug: "transformers",
    nameEn: "Transformers",
    nameZh: "Transformer",
    color: "#8f5f2f",
  },
  {
    slug: "frontend",
    nameEn: "Frontend",
    nameZh: "前端",
    color: "#7b6ab2",
  },
  {
    slug: "database",
    nameEn: "Database",
    nameZh: "数据库",
    color: "#b46b3a",
  },
];

const paperSeeds: PaperSeed[] = [
  {
    canonicalUrl: "https://arxiv.org/abs/1706.03762",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    tags: ["transformers", "llm"],
    paper: {
      title: "Attention Is All You Need",
      authors: [
        "Ashish Vaswani",
        "Noam Shazeer",
        "Niki Parmar",
        "Jakob Uszkoreit",
        "Llion Jones",
        "Aidan N. Gomez",
        "Lukasz Kaiser",
        "Illia Polosukhin",
      ],
      venue: "NeurIPS 2017",
      publishedAt: new Date("2017-06-12T00:00:00.000Z"),
      revisedAt: new Date("2017-12-06T00:00:00.000Z"),
      arxivId: "1706.03762",
      doi: null,
      landingUrl: "https://arxiv.org/abs/1706.03762",
      pdfUrl: "https://arxiv.org/pdf/1706.03762",
      abstract:
        "Introduces the Transformer architecture, replacing recurrent and convolutional sequence models with self-attention and feed-forward blocks.",
      problemStatement:
        "Sequence transduction models were bottlenecked by recurrence, limiting parallelism and long-range dependency modeling.",
      methodology:
        "Stacks multi-head self-attention, positional encodings, residual connections, and position-wise feed-forward networks in encoder-decoder layers.",
      keyFindings:
        "Self-attention improved translation quality while training substantially faster than recurrent baselines.",
      limitations:
        "The paper focuses on machine translation and leaves broader scaling behavior and deployment considerations to later work.",
      analysis: {
        contribution:
          "Defines the architecture that became the foundation for modern language models.",
        implementationHint:
          "Track attention heads, context length, and positional encoding choices when comparing later papers.",
      },
      relevanceScore: 10,
      relevanceNotes: "Core background for nearly every modern LLM, retrieval, and agent paper.",
    },
    summaries: [
      {
        language: Locale.EN,
        headline: "Transformer foundation paper",
        summary:
          "This paper introduces the Transformer, a sequence model built around self-attention rather than recurrence. It is essential background for understanding current LLM architectures and most downstream summarization or retrieval systems.",
        keyPoints: [
          "Self-attention enables more parallel training than recurrent networks.",
          "Multi-head attention captures several relationship patterns at once.",
          "The encoder-decoder design became a reusable template for later models.",
        ],
      },
      {
        language: Locale.ZH,
        headline: "Transformer 基础论文",
        summary:
          "这篇论文提出了以自注意力为核心的 Transformer，用它取代循环结构来处理序列建模。它是理解现代大语言模型、摘要系统和检索增强系统的关键基础。",
        keyPoints: [
          "自注意力让训练并行度显著提高。",
          "多头注意力可以同时捕捉多种关系模式。",
          "编码器-解码器结构成为后续模型的重要模板。",
        ],
      },
    ],
  },
  {
    canonicalUrl: "https://arxiv.org/abs/2005.11401",
    sourceUrl: "https://arxiv.org/abs/2005.11401",
    tags: ["retrieval", "llm"],
    paper: {
      title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
      authors: [
        "Patrick Lewis",
        "Ethan Perez",
        "Aleksandra Piktus",
        "Fabio Petroni",
        "Vladimir Karpukhin",
        "Naman Goyal",
        "Heinrich Kuttler",
        "Mike Lewis",
        "Wen-tau Yih",
        "Tim Rocktaschel",
        "Sebastian Riedel",
        "Douwe Kiela",
      ],
      venue: "NeurIPS 2020",
      publishedAt: new Date("2020-05-22T00:00:00.000Z"),
      revisedAt: new Date("2021-04-12T00:00:00.000Z"),
      arxivId: "2005.11401",
      doi: null,
      landingUrl: "https://arxiv.org/abs/2005.11401",
      pdfUrl: "https://arxiv.org/pdf/2005.11401",
      abstract:
        "Combines a parametric sequence-to-sequence model with a dense vector index so generation can condition on retrieved passages.",
      problemStatement:
        "Pure parametric models struggle to update factual knowledge and cite supporting evidence for knowledge-heavy tasks.",
      methodology:
        "Uses dense passage retrieval and marginalizes over retrieved documents during generation for sequence and token-level variants.",
      keyFindings:
        "Retrieval-augmented models improve open-domain question answering and knowledge-intensive generation benchmarks.",
      limitations:
        "Quality depends on retriever coverage, index freshness, and the model's ability to use retrieved evidence faithfully.",
      analysis: {
        contribution:
          "Establishes a practical recipe for coupling retrieval indexes with generative models.",
        implementationHint:
          "Evaluate retriever quality separately from generation quality when diagnosing failures.",
      },
      relevanceScore: 9,
      relevanceNotes:
        "Useful reference for paper ingestion, summarization, and daily research dashboard features.",
    },
    summaries: [
      {
        language: Locale.EN,
        headline: "Retrieval-grounded generation pattern",
        summary:
          "RAG connects a generator to a retriever so answers can use external documents instead of relying only on model parameters. It is directly relevant to systems that collect papers, repositories, and notes for synthesis.",
        keyPoints: [
          "Dense retrieval supplies evidence passages at generation time.",
          "The approach improves factual, knowledge-intensive tasks.",
          "Index freshness and retriever recall are central operational concerns.",
        ],
      },
      {
        language: Locale.ZH,
        headline: "检索增强生成范式",
        summary:
          "RAG 将生成模型与检索器连接起来，让回答可以基于外部文档，而不仅依赖模型参数。它与论文、代码仓库和笔记的自动整理与总结场景高度相关。",
        keyPoints: [
          "稠密检索在生成时提供证据段落。",
          "这种方法提升了知识密集型任务的事实性。",
          "索引新鲜度和检索召回率是关键工程问题。",
        ],
      },
    ],
  },
];

const repositorySeeds: RepositorySeed[] = [
  {
    canonicalUrl: "https://github.com/vercel/next.js",
    sourceUrl: "https://github.com/vercel/next.js",
    tags: ["frontend"],
    repository: {
      name: "next.js",
      url: "https://github.com/vercel/next.js",
      owner: "vercel",
      description:
        "The React framework for production applications, including App Router, server rendering, and API routes.",
      stars: 130000,
      forks: 28000,
      primaryLanguage: "JavaScript",
      lastUpdatedAt: new Date("2026-06-01T00:00:00.000Z"),
      readme:
        "Next.js provides a full-stack React framework with routing, rendering, bundling, and deployment-oriented conventions.",
      techStack: ["React", "TypeScript", "App Router", "Turbopack"],
      installDifficulty: InstallDifficulty.MEDIUM,
      installNotes:
        "Requires current Node.js, package manager setup, and environment-specific build configuration.",
      researchValueScore: 7,
      researchValueNotes:
        "Important implementation reference for dashboard shell, server components, and API boundaries.",
    },
    summaries: [
      {
        language: Locale.EN,
        headline: "Production React framework",
        summary:
          "Next.js is a strong reference repository for App Router conventions, server-rendered React, and production-ready frontend architecture. It is useful when designing the dashboard and ingestion UI surfaces.",
        keyPoints: [
          "Combines routing, rendering, and build tooling.",
          "App Router patterns fit server-first data access.",
          "Large ecosystem makes deployment and integration patterns easy to find.",
        ],
      },
      {
        language: Locale.ZH,
        headline: "生产级 React 框架",
        summary:
          "Next.js 是理解 App Router、服务端渲染 React 和生产级前端架构的重要参考仓库。它适合用来指导仪表盘和导入界面的工程实现。",
        keyPoints: [
          "集成路由、渲染和构建工具。",
          "App Router 适合以服务端数据访问为主的模式。",
          "生态成熟，部署和集成案例丰富。",
        ],
      },
    ],
  },
  {
    canonicalUrl: "https://github.com/prisma/prisma",
    sourceUrl: "https://github.com/prisma/prisma",
    tags: ["database"],
    repository: {
      name: "prisma",
      url: "https://github.com/prisma/prisma",
      owner: "prisma",
      description:
        "TypeScript ORM and database toolkit with schema modeling, migrations, and generated client APIs.",
      stars: 43000,
      forks: 1800,
      primaryLanguage: "TypeScript",
      lastUpdatedAt: new Date("2026-06-01T00:00:00.000Z"),
      readme:
        "Prisma centers database access around a declarative schema, migrations, and a generated type-safe client.",
      techStack: ["TypeScript", "PostgreSQL", "ORM", "Migrations"],
      installDifficulty: InstallDifficulty.EASY,
      installNotes:
        "Install the CLI and client packages, set DATABASE_URL, then run generate and migrations.",
      researchValueScore: 8,
      researchValueNotes:
        "Directly relevant to persistent data modeling, migrations, and typed service-layer code.",
    },
    summaries: [
      {
        language: Locale.EN,
        headline: "Typed database access toolkit",
        summary:
          "Prisma provides schema-driven PostgreSQL access and generated TypeScript types. It is the core persistence layer for the application and a useful reference for future migrations.",
        keyPoints: [
          "Schema definitions drive migrations and generated client types.",
          "PostgreSQL support matches the app persistence requirement.",
          "Generated APIs reduce manual SQL in service-layer code.",
        ],
      },
      {
        language: Locale.ZH,
        headline: "类型安全数据库工具",
        summary:
          "Prisma 通过 schema 驱动 PostgreSQL 访问，并生成 TypeScript 类型。它是本应用的核心持久化层，也适合作为后续迁移设计的参考。",
        keyPoints: [
          "Schema 定义驱动迁移和客户端类型生成。",
          "PostgreSQL 支持符合应用的持久化要求。",
          "生成式 API 可以减少服务层手写 SQL。",
        ],
      },
    ],
  },
];

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

async function upsertTags(): Promise<Map<string, string>> {
  const tagIdsBySlug = new Map<string, string>();

  for (const tag of tagSeeds) {
    const savedTag = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {
        nameEn: tag.nameEn,
        nameZh: tag.nameZh,
        color: tag.color,
      },
      create: tag,
    });

    tagIdsBySlug.set(savedTag.slug, savedTag.id);
  }

  return tagIdsBySlug;
}

async function setTagsForItem(
  itemId: string,
  tagSlugs: string[],
  tagIdsBySlug: Map<string, string>,
): Promise<void> {
  await prisma.itemTag.deleteMany({ where: { itemId } });

  const tagIds = tagSlugs.map((slug) => tagIdsBySlug.get(slug)).filter(isDefined);

  if (tagIds.length === 0) {
    return;
  }

  await prisma.itemTag.createMany({
    data: tagIds.map((tagId) => ({ itemId, tagId })),
    skipDuplicates: true,
  });
}

async function upsertSummaries(itemId: string, summaries: SummarySeed[]): Promise<void> {
  for (const summary of summaries) {
    await prisma.summary.upsert({
      where: {
        itemId_language: {
          itemId,
          language: summary.language,
        },
      },
      update: {
        headline: summary.headline,
        summary: summary.summary,
        keyPoints: summary.keyPoints,
        generatedBy: "seed",
        promptVersion: "seed-v1",
      },
      create: {
        itemId,
        language: summary.language,
        headline: summary.headline,
        summary: summary.summary,
        keyPoints: summary.keyPoints,
        generatedBy: "seed",
        promptVersion: "seed-v1",
      },
    });
  }
}

async function upsertPaper(seed: PaperSeed, tagIdsBySlug: Map<string, string>): Promise<void> {
  const item = await prisma.item.upsert({
    where: { canonicalUrl: seed.canonicalUrl },
    update: {
      kind: ItemKind.PAPER,
      sourceUrl: seed.sourceUrl,
      important: true,
      archived: false,
    },
    create: {
      kind: ItemKind.PAPER,
      sourceUrl: seed.sourceUrl,
      canonicalUrl: seed.canonicalUrl,
      important: true,
      archived: false,
    },
  });

  await prisma.paper.upsert({
    where: { itemId: item.id },
    update: seed.paper,
    create: {
      itemId: item.id,
      ...seed.paper,
    },
  });

  await upsertSummaries(item.id, seed.summaries);
  await setTagsForItem(item.id, seed.tags, tagIdsBySlug);
}

async function upsertRepository(
  seed: RepositorySeed,
  tagIdsBySlug: Map<string, string>,
): Promise<void> {
  const item = await prisma.item.upsert({
    where: { canonicalUrl: seed.canonicalUrl },
    update: {
      kind: ItemKind.REPOSITORY,
      sourceUrl: seed.sourceUrl,
      important: false,
      archived: false,
    },
    create: {
      kind: ItemKind.REPOSITORY,
      sourceUrl: seed.sourceUrl,
      canonicalUrl: seed.canonicalUrl,
      important: false,
      archived: false,
    },
  });

  await prisma.repository.upsert({
    where: { itemId: item.id },
    update: seed.repository,
    create: {
      itemId: item.id,
      ...seed.repository,
    },
  });

  await upsertSummaries(item.id, seed.summaries);
  await setTagsForItem(item.id, seed.tags, tagIdsBySlug);
}

async function main(): Promise<void> {
  const tagIdsBySlug = await upsertTags();

  for (const paper of paperSeeds) {
    await upsertPaper(paper, tagIdsBySlug);
  }

  for (const repository of repositorySeeds) {
    await upsertRepository(repository, tagIdsBySlug);
  }

  console.log(
    `Seeded ${paperSeeds.length} papers, ${repositorySeeds.length} repositories, and ${tagSeeds.length} tags.`,
  );
}

void main()
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
