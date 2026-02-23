import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    host_permissions: ["*://*.linkedin.com/*"],
    permissions: ["activeTab"],
  },
  modules: ["@wxt-dev/module-react"],
});
