export const OPENAPI_ROUTE = "/api/openapi";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getApiBaseUrl(request: Request): string {
  const configuredUrl = process.env.PUBLIC_API_BASE_URL ?? process.env.NEXT_URL;
  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  return trimTrailingSlash(new URL(request.url).origin);
}

export function buildOpenApiDocument(request: Request): Record<string, unknown> {
  const serverUrl = getApiBaseUrl(request);

  return {
    openapi: "3.1.0",
    info: {
      title: "Motian API",
      version: "0.1.0",
      description:
        "External REST API for the Motian recruitment platform. Most endpoints use Dutch route names and bearer-token authentication.",
    },
    servers: [{ url: serverUrl, description: "Current API server" }],
    tags: [
      { name: "System", description: "Health, documentation, and system routes" },
      { name: "Jobs", description: "Vacancy listing and detail operations" },
      { name: "Candidates", description: "Candidate listing and matching data" },
      { name: "Matching", description: "Match retrieval and generation routes" },
      { name: "Pipeline", description: "Applications, interviews, and messages" },
      { name: "Scraping", description: "Scraping configuration and run history" },
      { name: "Files", description: "CV upload and retrieval routes" },
      { name: "Privacy", description: "GDPR export and deletion routes" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API secret",
          description: "Send the API secret as `Authorization: Bearer <token>`.",
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      [OPENAPI_ROUTE]: {
        get: {
          tags: ["System"],
          summary: "Get the OpenAPI document",
          security: [],
          responses: { "200": { description: "OpenAPI JSON document" } },
        },
      },
      "/api/gezondheid": {
        get: {
          tags: ["System"],
          summary: "Read service health status",
          security: [],
          responses: { "200": { description: "Current health status" } },
        },
      },
      "/api/opdrachten": {
        get: {
          tags: ["Jobs"],
          summary: "List vacancies",
          description: "Supports query, platform, location, status, rate, and pagination filters.",
          responses: { "200": { description: "Paginated vacancy collection" } },
        },
        post: {
          tags: ["Jobs"],
          summary: "Create a vacancy",
          responses: { "201": { description: "Created vacancy" } },
        },
      },
      "/api/opdrachten/{id}": {
        get: {
          tags: ["Jobs"],
          summary: "Get a vacancy by id",
          responses: {
            "200": { description: "Vacancy detail" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["Jobs"],
          summary: "Update a vacancy",
          responses: { "200": { description: "Updated vacancy" } },
        },
      },
      "/api/kandidaten": {
        get: {
          tags: ["Candidates"],
          summary: "List candidates",
          responses: { "200": { description: "Paginated candidate collection" } },
        },
        post: {
          tags: ["Candidates"],
          summary: "Create a candidate",
          responses: { "201": { description: "Created candidate" } },
        },
      },
      "/api/candidates/{id}/matches": {
        get: {
          tags: ["Candidates"],
          summary: "List saved matches for one candidate",
          responses: { "200": { description: "Candidate match list" } },
        },
      },
      "/api/matches": {
        get: {
          tags: ["Matching"],
          summary: "List matches",
          responses: { "200": { description: "Match collection" } },
        },
        post: {
          tags: ["Matching"],
          summary: "Create or persist a match result",
          responses: { "201": { description: "Created match" } },
        },
      },
      "/api/sollicitaties": {
        get: {
          tags: ["Pipeline"],
          summary: "List applications",
          responses: { "200": { description: "Application collection" } },
        },
        post: {
          tags: ["Pipeline"],
          summary: "Create an application",
          responses: { "201": { description: "Created application" } },
        },
      },
      "/api/interviews": {
        get: {
          tags: ["Pipeline"],
          summary: "List interviews",
          responses: { "200": { description: "Interview collection" } },
        },
        post: {
          tags: ["Pipeline"],
          summary: "Create an interview",
          responses: { "201": { description: "Created interview" } },
        },
      },
      "/api/berichten": {
        get: {
          tags: ["Pipeline"],
          summary: "List messages",
          responses: { "200": { description: "Message collection" } },
        },
        post: {
          tags: ["Pipeline"],
          summary: "Create a message",
          responses: { "201": { description: "Created message" } },
        },
      },
      "/api/cv-upload": {
        post: {
          tags: ["Files"],
          summary: "Upload a CV file",
          responses: { "200": { description: "Stored file metadata" } },
        },
      },
      "/api/cv-file": {
        get: {
          tags: ["Files"],
          summary: "Read an uploaded CV file",
          responses: { "200": { description: "CV file stream or metadata" } },
        },
      },
      "/api/scraper-configuraties": {
        get: {
          tags: ["Scraping"],
          summary: "List scraper configurations",
          responses: { "200": { description: "Scraper configuration list" } },
        },
        patch: {
          tags: ["Scraping"],
          summary: "Update scraper configuration",
          responses: { "200": { description: "Updated configuration" } },
        },
      },
      "/api/scrape-resultaten": {
        get: {
          tags: ["Scraping"],
          summary: "List scrape run history",
          responses: { "200": { description: "Scrape run collection" } },
        },
      },
      "/api/scrape/starten": {
        post: {
          tags: ["Scraping"],
          summary: "Trigger a manual scrape",
          responses: {
            "202": { description: "Scrape accepted" },
            "200": { description: "Scrape started" },
          },
        },
      },
      "/api/gdpr/{action}": {
        post: {
          tags: ["Privacy"],
          summary: "Run GDPR export or deletion actions",
          responses: { "200": { description: "GDPR action completed" } },
        },
      },
    },
  };
}

export function buildScalarHtml(specUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Motian API Docs</title>
    <style>
      body { margin: 0; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: ${JSON.stringify(specUrl)},
        layout: 'modern',
        theme: 'purple',
        darkMode: true,
        defaultHttpClient: { targetKey: 'js', clientKey: 'fetch' },
        authentication: { preferredSecurityScheme: 'bearerAuth' },
      })
    </script>
  </body>
</html>`;
}
