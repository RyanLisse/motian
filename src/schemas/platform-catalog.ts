import { z } from "zod";

export const platformCatalogEntrySchema = z.object({
  slug: z.string(),
  displayName: z.string(),
  adapterKind: z.string(),
  authMode: z.string(),
  description: z.string(),
  docsUrl: z.string().nullable(),
  configSchema: z.record(z.unknown()),
  authSchema: z.record(z.unknown()),
  defaultBaseUrl: z.string().nullable(),
  config: z
    .object({
      id: z.string(),
      baseUrl: z.string(),
      isActive: z.boolean(),
      cronExpression: z.string().nullable(),
      parameters: z.unknown(),
    })
    .nullable(),
  latestRun: z
    .object({
      status: z.string(),
      blockerKind: z.string().nullable(),
    })
    .nullable(),
});

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

export type PlatformCatalogEntryFromSchema = z.infer<typeof platformCatalogEntrySchema>;
