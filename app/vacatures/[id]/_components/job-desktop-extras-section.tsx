import { FileText, Hash } from "lucide-react";
import type { FieldStyleProps, JobData } from "./job-field-types";

type JobDesktopExtrasSectionProps = {
  job: Pick<JobData, "externalId" | "clientReferenceCode" | "allowsSubcontracting">;
  metaFields: [string, string][];
  styles: FieldStyleProps;
};

export function JobDesktopExtrasSection({ job, metaFields, styles }: JobDesktopExtrasSectionProps) {
  const { iconSize, dtClass, ddClass, isMobile } = styles;

  if (isMobile) return null;

  return (
    <>
      {(job.externalId || job.clientReferenceCode) && (
        <div>
          <dt className={dtClass}>
            <Hash className={iconSize} /> Referentiecode
          </dt>
          <dd className="text-foreground font-mono text-xs">
            {job.clientReferenceCode || job.externalId}
          </dd>
        </div>
      )}
      {job.allowsSubcontracting !== null && (
        <div>
          <dt className={dtClass}>
            <FileText className={iconSize} /> Onderaanneming
          </dt>
          <dd className={ddClass}>{job.allowsSubcontracting ? "Toegestaan" : "Niet toegestaan"}</dd>
        </div>
      )}
      {metaFields.map(([label, value]) => (
        <div key={label}>
          <dt className={dtClass}>
            <FileText className={iconSize} /> {label}
          </dt>
          <dd className={ddClass}>{value}</dd>
        </div>
      ))}
    </>
  );
}
