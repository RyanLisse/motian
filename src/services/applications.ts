// Stub service — applications tabel nog niet in schema (Phase 13)
const STUB_MSG = "Applications tabel nog niet beschikbaar (Phase 13)";

export type ListApplicationsOpts = {
  jobId?: string;
  candidateId?: string;
  stage?: string;
  limit?: number;
};

export async function listApplications(_opts: ListApplicationsOpts) {
  return [];
}

export async function getApplicationById(_id: string) {
  return null;
}

export async function createApplication(_data: {
  jobId: string;
  candidateId: string;
  matchId?: string;
  source?: string;
  notes?: string;
}) {
  throw new Error(STUB_MSG);
}

export async function updateApplicationStage(
  _id: string,
  _stage: string,
  _notes?: string,
) {
  return null;
}

export async function getApplicationStats() {
  return { total: 0, byStage: {} };
}
