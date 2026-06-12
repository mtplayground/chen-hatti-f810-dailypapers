import { githubRepoFetchInputSchema, type GitHubRepoFetchInput } from "@/validators/github";

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type GitHubRepositoryLocator = {
  owner: string;
  repo: string;
};

type GitHubApiOwner = {
  login?: unknown;
};

type GitHubApiLicense = {
  spdx_id?: unknown;
};

type GitHubApiRepository = {
  name?: unknown;
  full_name?: unknown;
  html_url?: unknown;
  owner?: GitHubApiOwner;
  description?: unknown;
  stargazers_count?: unknown;
  forks_count?: unknown;
  language?: unknown;
  updated_at?: unknown;
  pushed_at?: unknown;
  default_branch?: unknown;
  topics?: unknown;
  license?: GitHubApiLicense | null;
};

type GitHubReadmeResponse = {
  content?: unknown;
  encoding?: unknown;
};

export type GitHubRepositoryMetadata = {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  primaryLanguage: string | null;
  lastUpdatedAt: Date | null;
  pushedAt: Date | null;
  defaultBranch: string | null;
  topics: string[];
  license: string | null;
  readme: string | null;
  sourceUrl: string;
  canonicalUrl: string;
};

export class GitHubRepoFetchError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_GITHUB_URL"
      | "NOT_FOUND"
      | "RATE_LIMITED"
      | "UPSTREAM_ERROR"
      | "PARSE_ERROR",
  ) {
    super(message);
    this.name = "GitHubRepoFetchError";
  }
}

export function extractGitHubRepository(input: string): GitHubRepositoryLocator | null {
  const value = input.trim();

  if (value.length === 0) {
    return null;
  }

  const sshMatch = value.match(/^git@github\.com:(?<owner>[^/]+)\/(?<repo>.+?)(?:\.git)?$/i);
  const sshOwner = sshMatch?.groups?.["owner"];
  const sshRepo = sshMatch?.groups?.["repo"];

  if (sshOwner !== undefined && sshRepo !== undefined) {
    return normalizeLocator(sshOwner, sshRepo);
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (hostname === "github.com" || hostname === "www.github.com") {
      const [owner, repo] = pathParts;
      return owner === undefined || repo === undefined ? null : normalizeLocator(owner, repo);
    }

    if (hostname === "api.github.com" && pathParts[0] === "repos") {
      const owner = pathParts[1];
      const repo = pathParts[2];
      return owner === undefined || repo === undefined ? null : normalizeLocator(owner, repo);
    }
  } catch {
    return null;
  }

  return null;
}

export async function fetchGitHubRepository(
  input: GitHubRepoFetchInput | string,
  options: { fetcher?: FetchLike; signal?: AbortSignal; token?: string | null } = {},
): Promise<GitHubRepositoryMetadata> {
  const { url } =
    typeof input === "string"
      ? githubRepoFetchInputSchema.parse({ url: input })
      : githubRepoFetchInputSchema.parse(input);
  const locator = extractGitHubRepository(url);

  if (locator === null) {
    throw new GitHubRepoFetchError(
      `Could not find a GitHub repository owner/name in "${url}".`,
      "INVALID_GITHUB_URL",
    );
  }

  const fetcher = options.fetcher ?? fetch;
  const token = options.token ?? process.env["GITHUB_TOKEN"] ?? process.env["GH_TOKEN"] ?? null;
  const repository = await requestGitHubJson<GitHubApiRepository>(
    fetcher,
    repoApiUrl(locator),
    token,
    options.signal,
  );
  const readme = await fetchReadme(fetcher, locator, token, options.signal);

  return repositoryToMetadata(repository, locator, url, readme);
}

async function requestGitHubJson<T>(
  fetcher: FetchLike,
  url: URL,
  token: string | null,
  signal: AbortSignal | undefined,
): Promise<T> {
  const response = await fetcher(url, githubRequestInit(token, signal));

  if (!response.ok) {
    throw await responseError(response);
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new GitHubRepoFetchError(
      `Could not parse GitHub API response: ${error instanceof Error ? error.message : "unknown error"}.`,
      "PARSE_ERROR",
    );
  }
}

async function fetchReadme(
  fetcher: FetchLike,
  locator: GitHubRepositoryLocator,
  token: string | null,
  signal: AbortSignal | undefined,
): Promise<string | null> {
  const response = await fetcher(readmeApiUrl(locator), githubRequestInit(token, signal));

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await responseError(response);
  }

  let body: GitHubReadmeResponse;

  try {
    body = (await response.json()) as GitHubReadmeResponse;
  } catch (error) {
    throw new GitHubRepoFetchError(
      `Could not parse GitHub README response: ${error instanceof Error ? error.message : "unknown error"}.`,
      "PARSE_ERROR",
    );
  }

  const content = stringValue(body.content);
  const encoding = stringValue(body.encoding);

  if (content === null) {
    return null;
  }

  if (encoding !== "base64") {
    throw new GitHubRepoFetchError(
      `Unsupported GitHub README encoding "${encoding ?? "unknown"}".`,
      "PARSE_ERROR",
    );
  }

  return normalizeReadme(Buffer.from(content.replace(/\s+/g, ""), "base64").toString("utf8"));
}

function repositoryToMetadata(
  repository: GitHubApiRepository,
  locator: GitHubRepositoryLocator,
  sourceUrl: string,
  readme: string | null,
): GitHubRepositoryMetadata {
  const owner = stringValue(repository.owner?.login) ?? locator.owner;
  const name = requiredString(repository.name, "name");
  const url = requiredString(repository.html_url, "html_url");
  const fullName = stringValue(repository.full_name) ?? `${owner}/${name}`;

  return {
    owner,
    name,
    fullName,
    url,
    description: stringValue(repository.description),
    stars: numberValue(repository.stargazers_count, "stargazers_count"),
    forks: numberValue(repository.forks_count, "forks_count"),
    primaryLanguage: stringValue(repository.language),
    lastUpdatedAt: dateValue(repository.updated_at),
    pushedAt: dateValue(repository.pushed_at),
    defaultBranch: stringValue(repository.default_branch),
    topics: stringArrayValue(repository.topics),
    license: stringValue(repository.license?.spdx_id),
    readme,
    sourceUrl,
    canonicalUrl: `https://github.com/${owner}/${name}`,
  };
}

async function responseError(response: Response): Promise<GitHubRepoFetchError> {
  const body = await safeResponseBody(response);
  const detail = body === null ? "" : ` ${body}`;

  if (response.status === 404) {
    return new GitHubRepoFetchError("GitHub repository was not found.", "NOT_FOUND");
  }

  if (response.status === 403 || response.status === 429) {
    return new GitHubRepoFetchError(
      `GitHub API rate limit or access policy rejected the request.${detail}`,
      "RATE_LIMITED",
    );
  }

  return new GitHubRepoFetchError(
    `GitHub API request failed with ${response.status} ${response.statusText}.${detail}`,
    "UPSTREAM_ERROR",
  );
}

async function safeResponseBody(response: Response): Promise<string | null> {
  try {
    const body = await response.text();
    return body.length === 0 ? null : body.slice(0, 500);
  } catch {
    return null;
  }
}

function githubRequestInit(token: string | null, signal: AbortSignal | undefined): RequestInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "chen-hatti-f810-dailypapers/0.1 github-fetcher",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };

  if (token !== null && token.trim().length > 0) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = { headers };

  if (signal !== undefined) {
    init.signal = signal;
  }

  return init;
}

function repoApiUrl(locator: GitHubRepositoryLocator): URL {
  return new URL(`/repos/${locator.owner}/${locator.repo}`, GITHUB_API_URL);
}

function readmeApiUrl(locator: GitHubRepositoryLocator): URL {
  return new URL(`/repos/${locator.owner}/${locator.repo}/readme`, GITHUB_API_URL);
}

function normalizeLocator(owner: string, repo: string): GitHubRepositoryLocator | null {
  const normalizedOwner = decodeURIComponent(owner.trim());
  const normalizedRepo = stripGitSuffix(decodeURIComponent(repo.trim()));

  if (!isValidOwner(normalizedOwner) || !isValidRepo(normalizedRepo)) {
    return null;
  }

  return {
    owner: normalizedOwner,
    repo: normalizedRepo,
  };
}

function stripGitSuffix(repo: string): string {
  return repo.replace(/\.git$/i, "");
}

function isValidOwner(owner: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(owner);
}

function isValidRepo(repo: string): boolean {
  return /^[a-z0-9._-]+$/i.test(repo);
}

function requiredString(value: unknown, field: string): string {
  const text = stringValue(value);

  if (text === null) {
    throw new GitHubRepoFetchError(`GitHub API response is missing ${field}.`, "PARSE_ERROR");
  }

  return text;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function numberValue(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new GitHubRepoFetchError(`GitHub API response has invalid ${field}.`, "PARSE_ERROR");
  }

  return value;
}

function dateValue(value: unknown): Date | null {
  const text = stringValue(value);

  if (text === null) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeReadme(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}
