import "dotenv/config";
import { createCliRenderer, TextAttributes } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useEffect, useMemo, useState } from "react";
import { createTuiActions } from "./actions";
import {
  getSollicitatieStats,
  getWorkspaceOverview,
  importJobsFromAts,
  reviewGdprRequests,
  runAutoMatchDemo,
  runCandidateScoring,
  zoekKandidaten,
  zoekMatches,
  zoekVacatures,
} from "./motian-actions";

const renderer = await createCliRenderer({ exitOnCtrlC: true });

function App() {
  const actions = useMemo(
    () =>
      createTuiActions({
        importJobsFromAts,
        runCandidateScoring,
        reviewGdprRequests,
        getWorkspaceOverview,
        zoekKandidaten,
        zoekVacatures,
        zoekMatches,
        getSollicitatieStats,
        runAutoMatchDemo,
      }),
    [],
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusTitle, setStatusTitle] = useState("Motian Operations TUI v2");
  const [statusLines, setStatusLines] = useState<string[]>([
    "Kies een actie en druk op Enter om uit te voeren.",
  ]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const runSelectedAction = async () => {
      const selectedAction = actions[selectedIndex];
      if (!selectedAction) return;
      setIsRunning(true);
      setStatusTitle(`Bezig: ${selectedAction.label}`);
      setStatusLines(["Actie gestart..."]);

      try {
        const result = await selectedAction.run();
        setStatusTitle(result.title);
        setStatusLines(result.lines);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatusTitle("Actie mislukt");
        setStatusLines([message]);
      } finally {
        setIsRunning(false);
      }
    };

    const keyHandler = (key: { name: string }) => {
      if (key.name === "q") {
        renderer.destroy();
        process.exit(0);
      }

      if (isRunning) return;

      if (key.name === "up" || key.name === "k") {
        setSelectedIndex((prev) => (prev - 1 + actions.length) % actions.length);
        return;
      }

      if (key.name === "down" || key.name === "j") {
        setSelectedIndex((prev) => (prev + 1) % actions.length);
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        void runSelectedAction();
      }
    };

    renderer.keyInput.on("keypress", keyHandler);
    return () => {
      renderer.keyInput.off("keypress", keyHandler);
    };
  }, [actions, isRunning, selectedIndex]);

  const menuText = actions
    .map((action, index) => `${index === selectedIndex ? ">" : " "} ${action.label}`)
    .join("\n");

  const detailText = actions[selectedIndex]?.description ?? "";
  const busyText = isRunning ? "Status: bezig..." : "Status: klaar";

  return (
    <box flexDirection="column" gap={1} paddingX={2} paddingY={1} flexGrow={1}>
      <text attributes={TextAttributes.BOLD}>Motian Operations TUI v2</text>
      <text attributes={TextAttributes.DIM}>
        Controls: up/down of j/k, Enter uitvoeren, q afsluiten
      </text>
      <text>{menuText}</text>
      <text attributes={TextAttributes.DIM}>{detailText}</text>
      <text>{busyText}</text>
      <text attributes={TextAttributes.BOLD}>{statusTitle}</text>
      <text>{statusLines.join("\n")}</text>
    </box>
  );
}

createRoot(renderer).render(<App />);
