import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const gitConfig = {
  branch: "main",
  repo: "motian",
  user: "cortex-air",
};

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    nav: {
      title: "Motian Docs",
    },
  };
}
