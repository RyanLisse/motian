export type RefreshScheduler = (
  callback: () => void,
  delayMs: number,
) => ReturnType<typeof setTimeout>;

export type RefreshCanceler = (handle: ReturnType<typeof setTimeout>) => void;

export function createRefreshCoalescer(
  refresh: () => void,
  {
    delayMs,
    schedule = setTimeout,
    cancel = clearTimeout,
  }: {
    delayMs: number;
    schedule?: RefreshScheduler;
    cancel?: RefreshCanceler;
  },
) {
  let pendingHandle: ReturnType<typeof setTimeout> | null = null;

  return {
    trigger() {
      if (pendingHandle !== null) {
        cancel(pendingHandle);
      }

      pendingHandle = schedule(() => {
        pendingHandle = null;
        refresh();
      }, delayMs);
    },
    cancel() {
      if (pendingHandle === null) return;
      cancel(pendingHandle);
      pendingHandle = null;
    },
  };
}
