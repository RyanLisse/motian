type FetchResponseLike = {
  ok: boolean;
  json: () => Promise<unknown>;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<FetchResponseLike>;

function getErrorMessage(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Opslaan mislukt";
}

export async function submitPlatformCredentials(input: {
  fetchFn?: FetchLike;
  platform: string;
  values: Record<string, string>;
}): Promise<unknown> {
  const fetchFn = input.fetchFn ?? fetch;
  const response = await fetchFn(`/api/platforms/${input.platform}/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.values),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload;
}
