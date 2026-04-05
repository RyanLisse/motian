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
        "Externe REST API voor het Motian recruitmentplatform. De meeste endpoints gebruiken Nederlandse route-namen en bearer-token authenticatie.",
    },
    servers: [{ url: serverUrl, description: "Huidige API-server" }],
    tags: [
      { name: "System", description: "Gezondheid, documentatie en systeemroutes" },
      { name: "Jobs", description: "Vacature-overzicht en detailoperaties" },
      { name: "Candidates", description: "Kandidatenoverzicht en matchgegevens" },
      { name: "Matching", description: "Routes voor matches ophalen en genereren" },
      { name: "Pipeline", description: "Sollicitaties, interviews en berichten" },
      { name: "Scraping", description: "Scraperconfiguratie en runhistorie" },
      { name: "Files", description: "CV-upload en ophaalroutes" },
      { name: "Privacy", description: "AVG-export- en verwijderroutes" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API secret",
          description: "Stuur de API-secret mee als `Authorization: Bearer <token>`.",
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      [OPENAPI_ROUTE]: {
        get: {
          tags: ["System"],
          summary: "OpenAPI-document ophalen",
          security: [],
          responses: { "200": { description: "OpenAPI JSON-document" } },
        },
      },
      "/api/gezondheid": {
        get: {
          tags: ["System"],
          summary: "Servicestatus lezen",
          security: [],
          responses: { "200": { description: "Huidige gezondheidsstatus" } },
        },
      },
      "/api/vacatures": {
        get: {
          tags: ["Jobs"],
          summary: "Vacatures ophalen",
          description:
            "Ondersteunt filters voor zoekterm, platform, locatie, status, tarief en paginering.",
          responses: { "200": { description: "Gepagineerde verzameling vacatures" } },
        },
        post: {
          tags: ["Jobs"],
          summary: "Vacature aanmaken",
          responses: { "201": { description: "Aangemaakte vacature" } },
        },
      },
      "/api/vacatures/{id}": {
        get: {
          tags: ["Jobs"],
          summary: "Vacature ophalen op id",
          responses: {
            "200": { description: "Vacaturedetail" },
            "404": { description: "Niet gevonden" },
          },
        },
        patch: {
          tags: ["Jobs"],
          summary: "Vacature bijwerken",
          responses: { "200": { description: "Bijgewerkte vacature" } },
        },
      },
      "/api/kandidaten": {
        get: {
          tags: ["Candidates"],
          summary: "Kandidaten ophalen",
          responses: { "200": { description: "Gepagineerde verzameling kandidaten" } },
        },
        post: {
          tags: ["Candidates"],
          summary: "Kandidaat aanmaken",
          responses: { "201": { description: "Aangemaakte kandidaat" } },
        },
      },
      "/api/kandidaten/{id}/vacature-scores": {
        post: {
          tags: ["Candidates", "Matching"],
          summary: "Matchscores t.o.v. opgegeven vacature-ID's",
          responses: { "200": { description: "Scores per vacature" } },
        },
      },
      "/api/commercieel-cv": {
        post: {
          tags: ["Candidates"],
          summary: "Concept commercieel CV (markdown)",
          responses: { "200": { description: "Titel en markdown-body" } },
        },
      },
      "/api/candidates/{id}/matches": {
        get: {
          tags: ["Candidates"],
          summary: "Opgeslagen matches voor één kandidaat ophalen",
          responses: { "200": { description: "Lijst met kandidaatmatches" } },
        },
      },
      "/api/matches": {
        get: {
          tags: ["Matching"],
          summary: "Matches ophalen",
          responses: { "200": { description: "Verzameling matches" } },
        },
        post: {
          tags: ["Matching"],
          summary: "Matchresultaat aanmaken of opslaan",
          responses: { "201": { description: "Aangemaakte match" } },
        },
      },
      "/api/sollicitaties": {
        get: {
          tags: ["Pipeline"],
          summary: "Sollicitaties ophalen",
          responses: { "200": { description: "Verzameling sollicitaties" } },
        },
        post: {
          tags: ["Pipeline"],
          summary: "Sollicitatie aanmaken",
          responses: { "201": { description: "Aangemaakte sollicitatie" } },
        },
      },
      "/api/interviews": {
        get: {
          tags: ["Pipeline"],
          summary: "Interviews ophalen",
          responses: { "200": { description: "Verzameling interviews" } },
        },
        post: {
          tags: ["Pipeline"],
          summary: "Interview aanmaken",
          responses: { "201": { description: "Aangemaakt interview" } },
        },
      },
      "/api/berichten": {
        get: {
          tags: ["Pipeline"],
          summary: "Berichten ophalen",
          responses: { "200": { description: "Verzameling berichten" } },
        },
        post: {
          tags: ["Pipeline"],
          summary: "Bericht aanmaken",
          responses: { "201": { description: "Aangemaakt bericht" } },
        },
      },
      "/api/cv-upload": {
        post: {
          tags: ["Files"],
          summary: "CV-bestand uploaden",
          responses: { "200": { description: "Opgeslagen bestandsmetadata" } },
        },
      },
      "/api/cv-file": {
        get: {
          tags: ["Files"],
          summary: "Geüpload CV-bestand ophalen",
          responses: { "200": { description: "CV-bestandsstream of metadata" } },
        },
      },
      "/api/scraper-configuraties": {
        get: {
          tags: ["Scraping"],
          summary: "Scraperconfiguraties ophalen",
          responses: { "200": { description: "Lijst met scraperconfiguraties" } },
        },
        patch: {
          tags: ["Scraping"],
          summary: "Scraperconfiguratie bijwerken",
          responses: { "200": { description: "Bijgewerkte configuratie" } },
        },
      },
      "/api/scrape-resultaten": {
        get: {
          tags: ["Scraping"],
          summary: "Scraperunhistorie ophalen",
          responses: { "200": { description: "Verzameling scraperuns" } },
        },
      },
      "/api/scrape/starten": {
        post: {
          tags: ["Scraping"],
          summary: "Handmatige scrape starten",
          responses: {
            "202": { description: "Scrape geaccepteerd" },
            "200": { description: "Scrape gestart" },
          },
        },
      },
      "/api/gdpr/{action}": {
        post: {
          tags: ["Privacy"],
          summary: "AVG-export- of verwijderactie uitvoeren",
          responses: { "200": { description: "AVG-actie voltooid" } },
        },
      },
    },
  };
}

export function buildScalarHtml(specUrl: string): string {
  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Motian API-documentatie</title>
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
