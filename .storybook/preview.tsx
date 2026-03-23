import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const VIEWPORT_PRESETS = {
  mobile: {
    name: "Mobile",
    styles: { width: "375px", height: "667px" },
    type: "mobile" as const,
  },
  tablet: {
    name: "Tablet",
    styles: { width: "768px", height: "1024px" },
    type: "tablet" as const,
  },
  desktop: {
    name: "Desktop",
    styles: { width: "1280px", height: "800px" },
    type: "desktop" as const,
  },
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    docs: {
      autodocs: "tag",
    },
    viewport: {
      viewports: VIEWPORT_PRESETS,
    },
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals?.theme as "light" | "dark" | undefined) ?? "dark";
      const wrapperClass =
        theme === "dark" ? "dark bg-[#0d0d0d] p-6 min-h-screen" : "p-6 min-h-screen bg-background";
      return (
        <div className={wrapperClass}>
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
