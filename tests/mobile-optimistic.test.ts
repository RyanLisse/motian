import { describe, expect, it } from "vitest";
import { appendOptimisticNote, moveStageCard } from "../src/lib/mobile-optimistic";

describe("mobile optimistic helpers", () => {
  it("appends a new note with paragraph spacing", () => {
    expect(appendOptimisticNote("Eerste notitie", "Tweede notitie")).toBe(
      "Eerste notitie\n\nTweede notitie",
    );
  });

  it("moves a card between pipeline stages without mutating unrelated stages", () => {
    const state = {
      new: [{ id: "app-1" }, { id: "app-2" }],
      screening: [{ id: "app-3" }],
    };

    const next = moveStageCard(state, {
      cardId: "app-2",
      fromStage: "new",
      toStage: "screening",
    });

    expect(next.new).toEqual([{ id: "app-1" }]);
    expect(next.screening).toEqual([{ id: "app-2" }, { id: "app-3" }]);
    expect(state.new).toEqual([{ id: "app-1" }, { id: "app-2" }]);
  });
});
