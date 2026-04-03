import { revalidatePath } from "next/cache";
import { publish } from "../lib/event-bus";
import { autoMatchJobToCandidates } from "./auto-matching";
import { createJob, deleteJob, updateJob } from "./jobs";

export type CreateJobData = {
  title: string;
  platform: string;
  externalId?: string;
  company?: string;
  endClient?: string;
  description?: string;
  location?: string;
  province?: string;
  rateMin?: number;
  rateMax?: number;
  contractType?: string;
  workArrangement?: string;
  hoursPerWeek?: number;
};

export type UpdateJobData = {
  title?: string;
  description?: string;
  location?: string;
  rateMin?: number;
  rateMax?: number;
  contractType?: string;
  workArrangement?: string;
};

export async function createJobWithEffects(data: CreateJobData) {
  const result = await createJob({
    ...data,
    externalId: data.externalId || `handmatig-${crypto.randomUUID()}`,
  });
  revalidatePath("/vacatures");
  revalidatePath("/overzicht");
  publish("job:created", { id: result.id });
  return result;
}

export async function updateJobWithEffects(id: string, data: UpdateJobData) {
  const result = await updateJob(id, data);
  if (!result) return null;
  revalidatePath("/vacatures");
  revalidatePath(`/vacatures/${id}`);
  publish("job:updated", { id });
  return result;
}

export async function deleteJobWithEffects(id: string) {
  const deleted = await deleteJob(id);
  if (!deleted) return false;
  revalidatePath("/vacatures");
  revalidatePath("/overzicht");
  publish("job:deleted", { id });
  return true;
}

export async function autoMatchJobWithEffects(jobId: string) {
  return autoMatchJobToCandidates(jobId);
}
