export const ARXIV_CUSTOM_FIELD_ID = "custom";

export type ArxivFieldPresetId =
  | "llm-agents"
  | "computer-vision"
  | "robotics"
  | "nlp"
  | "systems"
  | typeof ARXIV_CUSTOM_FIELD_ID;

export type ArxivFieldPreset = {
  id: ArxivFieldPresetId;
  label: string;
  description: string;
  keywords: string[];
};

export const ARXIV_FIELD_PRESETS: readonly ArxivFieldPreset[] = [
  {
    id: "llm-agents",
    label: "LLM/Agents",
    description: "Large language models, retrieval, tool use, and autonomous agents.",
    keywords: [
      "large language model",
      "LLM",
      "agentic",
      "AI agents",
      "retrieval augmented generation",
      "tool use",
      "reasoning",
    ],
  },
  {
    id: "computer-vision",
    label: "Computer Vision",
    description:
      "Vision models, image/video understanding, detection, segmentation, and multimodal perception.",
    keywords: [
      "computer vision",
      "image understanding",
      "video understanding",
      "object detection",
      "semantic segmentation",
      "visual representation learning",
      "multimodal vision",
    ],
  },
  {
    id: "robotics",
    label: "Robotics",
    description: "Robot learning, control, manipulation, navigation, and embodied AI.",
    keywords: [
      "robotics",
      "robot learning",
      "manipulation",
      "navigation",
      "motion planning",
      "embodied AI",
      "reinforcement learning robotics",
    ],
  },
  {
    id: "nlp",
    label: "NLP",
    description: "Natural language processing, language understanding, generation, and evaluation.",
    keywords: [
      "natural language processing",
      "NLP",
      "language understanding",
      "text generation",
      "machine translation",
      "information extraction",
      "evaluation benchmark",
    ],
  },
  {
    id: "systems",
    label: "Systems",
    description:
      "Distributed systems, databases, compilers, operating systems, and ML systems infrastructure.",
    keywords: [
      "distributed systems",
      "database systems",
      "operating systems",
      "compilers",
      "machine learning systems",
      "systems performance",
      "cloud infrastructure",
    ],
  },
  {
    id: ARXIV_CUSTOM_FIELD_ID,
    label: "Custom",
    description: "User-provided arXiv keyword set.",
    keywords: [],
  },
] as const;

export type ResolveArxivFieldKeywordsInput = {
  field?: string | null | undefined;
  keywords?: string[] | null | undefined;
};

export type ResolvedArxivFieldKeywords = {
  field: ArxivFieldPreset;
  keywords: string[];
  source: "preset" | "custom";
};

export class ArxivFieldPresetError extends Error {
  constructor(
    message: string,
    readonly code: "UNKNOWN_FIELD" | "CUSTOM_KEYWORDS_REQUIRED",
  ) {
    super(message);
    this.name = "ArxivFieldPresetError";
  }
}

export function listArxivFieldPresets(): ArxivFieldPreset[] {
  return ARXIV_FIELD_PRESETS.map((preset) => ({ ...preset, keywords: [...preset.keywords] }));
}

export function getArxivFieldPreset(field: string): ArxivFieldPreset {
  const normalized = normalizeFieldId(field);
  const preset = ARXIV_FIELD_PRESETS.find((candidate) => candidate.id === normalized);

  if (preset === undefined) {
    throw new ArxivFieldPresetError(`Unknown arXiv field preset "${field}".`, "UNKNOWN_FIELD");
  }

  return { ...preset, keywords: [...preset.keywords] };
}

export function resolveArxivFieldKeywords(
  input: ResolveArxivFieldKeywordsInput,
): ResolvedArxivFieldKeywords | null {
  const keywords = uniqueKeywords(input.keywords ?? []);
  const field = input.field?.trim();

  if (field === undefined || field === "") {
    return keywords.length === 0
      ? null
      : {
          field: getArxivFieldPreset(ARXIV_CUSTOM_FIELD_ID),
          keywords,
          source: "custom",
        };
  }

  const preset = getArxivFieldPreset(field);

  if (preset.id === ARXIV_CUSTOM_FIELD_ID) {
    if (keywords.length === 0) {
      throw new ArxivFieldPresetError(
        "Custom arXiv field fetches require at least one keyword.",
        "CUSTOM_KEYWORDS_REQUIRED",
      );
    }

    return {
      field: preset,
      keywords,
      source: "custom",
    };
  }

  return {
    field: preset,
    keywords: [...preset.keywords],
    source: "preset",
  };
}

function normalizeFieldId(field: string): string {
  const value = field.trim().toLowerCase();

  if (value === "llm/agents" || value === "llm agents" || value === "agents") {
    return "llm-agents";
  }

  if (value === "cv" || value === "vision") {
    return "computer-vision";
  }

  return value.replaceAll("_", "-").replaceAll(/\s+/g, "-");
}

function uniqueKeywords(keywords: readonly string[]): string[] {
  return [
    ...new Set(keywords.map((keyword) => keyword.trim()).filter((keyword) => keyword !== "")),
  ];
}
