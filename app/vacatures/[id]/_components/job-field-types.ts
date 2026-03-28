export type JobData = {
  company: string | null;
  rateMin: number | null;
  rateMax: number | null;
  startDate: Date | null;
  endDate: Date | null;
  hoursPerWeek: number | null;
  minHoursPerWeek: number | null;
  durationMonths: number | null;
  location: string | null;
  workArrangement: string | null;
  educationLevel: string | null;
  workExperienceYears: number | null;
  extensionPossible: boolean | null;
  applicationDeadline: Date | null;
  contractLabel: string | null;
  positionsAvailable: number | null;
  externalId: string | null;
  clientReferenceCode: string | null;
  allowsSubcontracting: boolean | null;
};

export type FieldStyleProps = {
  iconSize: string;
  dtClass: string;
  ddClass: string;
  ddFontClass: string;
  dateFormat: "short" | "long";
  isMobile: boolean;
};

export const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};
