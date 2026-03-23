import { tool } from "ai";
import { z } from "zod";

export const readCanvasState = tool({
  description:
    "Lees de huidige staat van het canvas — welke nodes, edges en selecties er zichtbaar zijn. Gebruik dit om context te krijgen over wat de recruiter op het canvas ziet.",
  inputSchema: z.object({}),
  execute: async () => {
    // Canvas state is client-side. This tool serves as a signal to the frontend
    // to inject the current canvas state into the next message context.
    // The actual state injection happens via the chat context provider.
    return {
      message:
        "Canvas state wordt gelezen uit de frontend context. Vraag de recruiter wat ze zien op het canvas, of gebruik renderCanvas om een nieuw netwerk te genereren.",
      note: "Bidirectionele canvas integratie wordt in een toekomstige update volledig geïmplementeerd.",
    };
  },
});
