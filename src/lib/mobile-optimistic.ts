export type StageCard = {
  id: string;
};

export function moveStageCard<T extends StageCard>(
  state: Record<string, T[]>,
  {
    cardId,
    fromStage,
    toStage,
  }: {
    cardId: string;
    fromStage: string;
    toStage: string;
  },
) {
  if (fromStage === toStage) return state;

  const next = { ...state };
  const fromCards = [...(next[fromStage] ?? [])];
  const cardIndex = fromCards.findIndex((card) => card.id === cardId);

  if (cardIndex === -1) return state;

  const [card] = fromCards.splice(cardIndex, 1);
  next[fromStage] = fromCards;
  next[toStage] = [card, ...(next[toStage] ?? [])];

  return next;
}

export function appendOptimisticNote(existingNotes: string | null, nextNote: string) {
  const trimmedNextNote = nextNote.trim();
  if (!trimmedNextNote) return existingNotes ?? "";

  const trimmedExisting = existingNotes?.trim();
  if (!trimmedExisting) return trimmedNextNote;

  return `${trimmedExisting}\n\n${trimmedNextNote}`;
}
