import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "Motian LinkedIn Importer",
    description: "Importeer LinkedIn profielen naar het Motian recruitment platform",
    host_permissions: ["*://*.linkedin.com/*"],
    permissions: ["activeTab", "storage"],
  },
  modules: ["@wxt-dev/module-react"],
});
