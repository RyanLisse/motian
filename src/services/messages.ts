// Stub service — messages tabel nog niet in schema (Phase 13)
const STUB_MSG = "Messages tabel nog niet beschikbaar (Phase 13)";

export type ListMessagesOpts = {
  applicationId?: string;
  direction?: string;
  channel?: string;
  limit?: number;
};

export async function listMessages(_opts: ListMessagesOpts) {
  return [];
}

export async function getMessageById(_id: string) {
  return null;
}

export async function createMessage(_data: {
  applicationId: string;
  direction: string;
  channel: string;
  subject?: string;
  body: string;
}): Promise<Record<string, unknown> | null> {
  return null; // Stub — returns null until Phase 13
}
