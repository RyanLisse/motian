export type PlatformCatalogEntry = {
  slug: string;
  displayName: string;
  adapterKind: string;
  authMode: string;
  description: string;
  docsUrl: string | null;
  configSchema: Record<string, unknown>;
  authSchema: Record<string, unknown>;
  defaultBaseUrl: string | null;
  config: {
    id: string;
    baseUrl: string;
    isActive: boolean;
    cronExpression: string | null;
    parameters: unknown;
  } | null;
  latestRun: {
    status: string;
    blockerKind: string | null;
  } | null;
};
