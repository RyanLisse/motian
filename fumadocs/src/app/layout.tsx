import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";

import "./global.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Motian Docs",
    template: "%s | Motian Docs",
  },
  description:
    "Documentatie voor het Motian AI-Recruitment Platform — matching, scraping, CV-analyse en meer.",
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
