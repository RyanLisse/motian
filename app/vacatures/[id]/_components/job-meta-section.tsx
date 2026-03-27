import { Building2, Euro } from "lucide-react";
import type { FieldStyleProps, JobData } from "./job-field-types";

type JobMetaSectionProps = {
  job: Pick<JobData, "company" | "rateMin" | "rateMax">;
  styles: FieldStyleProps;
};

export function JobMetaSection({ job, styles }: JobMetaSectionProps) {
  const { iconSize, dtClass, ddClass, ddFontClass } = styles;

  const rateDisplay =
    job.rateMin && job.rateMax
      ? `EUR ${job.rateMin} - ${job.rateMax}`
      : job.rateMax
        ? `max EUR ${job.rateMax}`
        : job.rateMin
          ? `min EUR ${job.rateMin}`
          : null;

  return (
    <>
      {job.company && (
        <div>
          <dt className={dtClass}>
            <Building2 className={iconSize} /> Opdrachtgever
          </dt>
          <dd className={ddFontClass}>{job.company}</dd>
        </div>
      )}
      {rateDisplay && (
        <div>
          <dt className={dtClass}>
            <Euro className={iconSize} /> Uurtarief
          </dt>
          <dd className={ddClass}>{rateDisplay}</dd>
        </div>
      )}
    </>
  );
}
