const PERSISTED_CHAT_SESSIONS_KEY = "motian-chat-persisted-sessions";
const STORAGE_TEST_KEY = "__motian_chat_storage__";
const MAX_PERSISTED_CHAT_SESSIONS = 50;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;

  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function isSessionStorageAvailable(storage?: StorageLike | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    target.setItem(STORAGE_TEST_KEY, "1");
    target.removeItem(STORAGE_TEST_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readSessionStorage(key: string, storage?: StorageLike | null): string | null {
  const target = resolveStorage(storage);
  if (!target || !isSessionStorageAvailable(target)) return null;

  try {
    return target.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionStorage(
  key: string,
  value: string | null,
  storage?: StorageLike | null,
) {
  const target = resolveStorage(storage);
  if (!target || !isSessionStorageAvailable(target)) return;

  try {
    if (value == null) {
      target.removeItem(key);
      return;
    }

    target.setItem(key, value);
  } catch {
    // Ignore storage failures in private / embedded contexts.
  }
}

function readPersistedChatSessions(storage?: StorageLike | null): string[] {
  const raw = readSessionStorage(PERSISTED_CHAT_SESSIONS_KEY, storage);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];
  } catch {
    writeSessionStorage(PERSISTED_CHAT_SESSIONS_KEY, null, storage);
    return [];
  }
}

export function hasPersistedChatSession(sessionId: string, storage?: StorageLike | null): boolean {
  if (!sessionId) return false;
  return readPersistedChatSessions(storage).includes(sessionId);
}

export function markPersistedChatSession(sessionId: string, storage?: StorageLike | null) {
  if (!sessionId) return;

  const existing = readPersistedChatSessions(storage);
  if (existing.includes(sessionId)) return;

  writeSessionStorage(
    PERSISTED_CHAT_SESSIONS_KEY,
    JSON.stringify([...existing, sessionId].slice(-MAX_PERSISTED_CHAT_SESSIONS)),
    storage,
  );
}

export function clearPersistedChatSession(sessionId: string, storage?: StorageLike | null) {
  if (!sessionId) return;

  const remaining = readPersistedChatSessions(storage).filter((existing) => existing !== sessionId);
  writeSessionStorage(
    PERSISTED_CHAT_SESSIONS_KEY,
    remaining.length > 0 ? JSON.stringify(remaining) : null,
    storage,
  );
}
