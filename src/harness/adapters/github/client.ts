interface GitHubGraphQLErrorItem {
  message: string;
  path?: Array<number | string>;
  type?: string;
}

interface GitHubGraphQLResponse<TData> {
  data?: TData;
  errors?: GitHubGraphQLErrorItem[];
}

export class GitHubApiError extends Error {
  readonly issues: GitHubGraphQLErrorItem[];
  readonly requestId: string | null;
  readonly status: number;

  constructor(
    message: string,
    options: { issues?: GitHubGraphQLErrorItem[]; requestId?: string | null; status: number },
  ) {
    super(message);
    this.name = "GitHubApiError";
    this.issues = options.issues ?? [];
    this.requestId = options.requestId ?? null;
    this.status = options.status;
  }
}

export class GitHubApiClient {
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly token: string;
  private readonly userAgent: string;

  constructor(options: {
    apiBaseUrl?: string;
    fetch?: typeof fetch;
    token: string;
    userAgent?: string;
  }) {
    const token = options.token.trim();

    if (!token) {
      throw new Error("GitHub-token ontbreekt of is leeg.");
    }

    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.github.com";
    this.fetchImpl = options.fetch ?? fetch;
    this.token = token;
    this.userAgent = options.userAgent ?? "motian-harness-github-adapter";
  }

  async graphql<TData>(query: string, variables: Record<string, unknown>): Promise<TData> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}/graphql`, {
      body: JSON.stringify({ query, variables }),
      headers: this.getHeaders(),
      method: "POST",
    });

    const requestId = response.headers.get("x-github-request-id");
    const payload = (await response.json()) as GitHubGraphQLResponse<TData>;

    if (!response.ok || payload.errors?.length) {
      const details =
        payload.errors?.map((error) => error.message).join("; ") ?? response.statusText;
      throw new GitHubApiError(
        details
          ? `GitHub GraphQL-aanvraag mislukt: ${details}`
          : "GitHub GraphQL-aanvraag mislukt.",
        {
          issues: payload.errors,
          requestId,
          status: response.status,
        },
      );
    }

    if (!payload.data) {
      throw new GitHubApiError("GitHub GraphQL-antwoord bevatte geen data.", {
        requestId,
        status: response.status,
      });
    }

    return payload.data;
  }

  async rest<TData>(path: string, init: Omit<RequestInit, "headers"> = {}): Promise<TData> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...this.getHeaders(),
        Accept: "application/vnd.github+json",
      },
    });

    const requestId = response.headers.get("x-github-request-id");
    const payload = (await response.json()) as TData & { message?: string };

    if (!response.ok) {
      const details = payload.message || response.statusText;
      throw new GitHubApiError(
        details ? `GitHub REST-aanvraag mislukt: ${details}` : "GitHub REST-aanvraag mislukt.",
        {
          requestId,
          status: response.status,
        },
      );
    }

    return payload;
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      "User-Agent": this.userAgent,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }
}
