import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <div className="dark bg-[#0d0d0d] p-6 min-h-screen">
        <Story />
      </div>
    ),
  ],
};

export default preview;
