import { Briefcase, Users } from "lucide-react";
import type { FieldStyleProps, JobData } from "./job-field-types";

type JobContractSectionProps = {
  job: Pick<JobData, "contractLabel" | "positionsAvailable">;
  styles: FieldStyleProps;
};

export function JobContractSection({ job, styles }: JobContractSectionProps) {
  const { iconSize, dtClass, ddClass } = styles;

  return (
    <>
      {job.contractLabel && (
        <div>
          <dt className={dtClass}>
            <Briefcase className={iconSize} /> Contract
          </dt>
          <dd className={ddClass}>{job.contractLabel}</dd>
        </div>
      )}
      {job.positionsAvailable && (
        <div>
          <dt className={dtClass}>
            <Users className={iconSize} /> Posities
          </dt>
          <dd className={ddClass}>{job.positionsAvailable}</dd>
        </div>
      )}
    </>
  );
}
