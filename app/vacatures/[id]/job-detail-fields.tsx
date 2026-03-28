import { JobContractSection } from "./_components/job-contract-section";
import { JobDeadlineSection } from "./_components/job-deadline-section";
import { JobDesktopExtrasSection } from "./_components/job-desktop-extras-section";
import type { FieldStyleProps, JobData } from "./_components/job-field-types";
import { JobLocationSection } from "./_components/job-location-section";
import { JobMetaSection } from "./_components/job-meta-section";
import { JobRequirementsSection } from "./_components/job-requirements-section";
import { JobScheduleSection } from "./_components/job-schedule-section";

export type { JobData };

type JobDetailFieldsProps = {
  job: JobData;
  /** Extra condition key-value pairs from parsed conditions */
  metaFields?: [string, string][];
  /** "mobile" uses compact 2-col grid, "desktop" uses vertical list */
  variant: "mobile" | "desktop";
};

export function JobDetailFields({ job, metaFields = [], variant }: JobDetailFieldsProps) {
  const isMobile = variant === "mobile";

  const styles: FieldStyleProps = {
    isMobile,
    iconSize: isMobile ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5",
    dateFormat: isMobile ? "short" : "long",
    dtClass: isMobile
      ? "text-muted-foreground text-xs mb-0.5 flex items-center gap-1"
      : "text-muted-foreground text-xs mb-0.5 flex items-center gap-1.5",
    ddClass: isMobile ? "text-foreground text-xs" : "text-foreground",
    ddFontClass: isMobile ? "text-foreground font-medium text-xs" : "text-foreground font-medium",
  };

  return (
    <>
      <JobMetaSection job={job} styles={styles} />
      <JobScheduleSection job={job} styles={styles} />
      <JobLocationSection job={job} styles={styles} />
      <JobRequirementsSection job={job} styles={styles} />
      <JobDeadlineSection job={job} styles={styles} />
      <JobContractSection job={job} styles={styles} />
      <JobDesktopExtrasSection job={job} metaFields={metaFields} styles={styles} />
    </>
  );
}
