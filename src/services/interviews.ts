// Stub service — interviews tabel nog niet in schema (Phase 13)
const STUB_MSG = "Interviews tabel nog niet beschikbaar (Phase 13)";

export type ListInterviewsOpts = {
  applicationId?: string;
  status?: string;
  limit?: number;
};

export async function listInterviews(_opts: ListInterviewsOpts) {
  return [];
}

export async function getInterviewById(_id: string) {
  return null;
}

export async function createInterview(_data: {
  applicationId: string;
  scheduledAt: Date;
  type: string;
  interviewer: string;
  duration?: number;
  location?: string;
}) {
  throw new Error(STUB_MSG);
}

export async function updateInterview(
  _id: string,
  data: { status?: string; feedback?: string; rating?: number },
) {
  return {
    interview: null,
    emptyUpdate: !data.status && !data.feedback && !data.rating,
  };
}

export async function getUpcomingInterviews() {
  return [];
}
