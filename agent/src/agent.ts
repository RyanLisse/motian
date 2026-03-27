import { voice } from "@livekit/agents";
import { createMotianTools } from "./tools";

/**
 * Motian recruitment voice agent.
 *
 * Exposed tools allow the agent to search jobs, find candidates,
 * and create matches — all via voice commands.
 */
export class MotianAgent extends voice.Agent {
  constructor() {
    super({
      instructions: `Je bent Motian AI, de slimme recruitment assistent.
Antwoord in het Nederlands tenzij de gebruiker Engels spreekt.
Je helpt met vacatures zoeken, kandidaten beheren, en matches maken.
Houd antwoorden kort en duidelijk — je praat via spraak.
Gebruik een professionele maar vriendelijke toon.
Als je iets niet weet, zeg dat eerlijk.`,

      tools: createMotianTools(),
    });
  }
}
