import { revalidatePath } from "next/cache";
import { publish } from "../lib/event-bus";
import { createApplication, deleteApplication, updateApplicationStage } from "./applications";
import { createInterview, deleteInterview, updateInterview } from "./interviews";
import { createMessage, deleteMessage, updateMessage } from "./messages";

// ========== Applications ==========

export type CreateApplicationData = {
  jobId: string;
  candidateId: string;
  matchId?: string;
  source?: string;
  notes?: string;
};

export async function createApplicationWithEffects(data: CreateApplicationData) {
  const application = await createApplication(data);
  revalidatePath("/pipeline");
  revalidatePath("/overzicht");
  publish("application:created", { id: (application as { id: string }).id });
  return application;
}

export async function updateApplicationStageWithEffects(id: string, stage: string, notes?: string) {
  const result = await updateApplicationStage(id, stage, notes);
  if (!result) return null;
  revalidatePath("/pipeline");
  publish("application:updated", { id, stage });
  return result;
}

export async function deleteApplicationWithEffects(id: string) {
  const deleted = await deleteApplication(id);
  if (!deleted) return false;
  revalidatePath("/pipeline");
  publish("application:deleted", { id });
  return true;
}

// ========== Interviews ==========

export type CreateInterviewData = {
  applicationId: string;
  scheduledAt: Date;
  type: "phone" | "video" | "onsite" | "technical";
  interviewer: string;
  duration?: number;
  location?: string;
};

export type UpdateInterviewData = {
  status?: "scheduled" | "completed" | "cancelled";
  feedback?: string;
  rating?: number;
};

export async function createInterviewWithEffects(data: CreateInterviewData) {
  const interview = await createInterview(data);
  revalidatePath("/interviews");
  publish("interview:created", { id: (interview as { id: string }).id });
  return interview;
}

export async function updateInterviewWithEffects(id: string, data: UpdateInterviewData) {
  const { interview, emptyUpdate } = await updateInterview(id, data);
  if (emptyUpdate) return { error: "Geen velden opgegeven om bij te werken" as const };
  if (!interview) return { error: "Interview niet gevonden of ongeldige waarden" as const };
  revalidatePath("/interviews");
  publish("interview:updated", { id });
  return { interview };
}

export async function deleteInterviewWithEffects(id: string) {
  const deleted = await deleteInterview(id);
  if (!deleted) return false;
  revalidatePath("/interviews");
  publish("interview:deleted", { id });
  return true;
}

// ========== Messages ==========

export type CreateMessageData = {
  applicationId: string;
  direction: "inbound" | "outbound";
  channel: "email" | "phone" | "platform";
  subject?: string;
  body: string;
};

export type UpdateMessageData = {
  subject?: string;
  body?: string;
};

export async function createMessageWithEffects(data: CreateMessageData) {
  const result = await createMessage(data);
  if (!result) return null;
  revalidatePath("/berichten");
  publish("message:created", { id: (result as { id: string }).id });
  return result;
}

export async function updateMessageWithEffects(id: string, data: UpdateMessageData) {
  const result = await updateMessage(id, data);
  if (!result) return null;
  revalidatePath("/berichten");
  publish("message:updated", { id });
  return result;
}

export async function deleteMessageWithEffects(id: string) {
  const deleted = await deleteMessage(id);
  if (!deleted) return false;
  revalidatePath("/berichten");
  publish("message:deleted", { id });
  return true;
}
