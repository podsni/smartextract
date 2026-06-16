import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "SmartExtract",
    description:
      "Extract web content into clean Markdown or Plain Text instantly.",
    version: "2.4.1",
    permissions: [
      "activeTab",
      "scripting",
      "storage",
      "contextMenus",
      "clipboardWrite",
    ],
    action: {
      default_popup: "entrypoints/popup/index.html",
      default_icon: {
        "16": "icon-16.png",
        "32": "icon-32.png",
        "48": "icon-48.png",
        "128": "icon-128.png",
      },
    },
    icons: {
      "16": "icon-16.png",
      "32": "icon-32.png",
      "48": "icon-48.png",
      "128": "icon-128.png",
    },
  },
});
