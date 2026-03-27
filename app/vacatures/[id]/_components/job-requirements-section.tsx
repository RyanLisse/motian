import { Briefcase, GraduationCap } from "lucide-react";
import type { FieldStyleProps, JobData } from "./job-field-types";

type JobRequirementsSectionProps = {
  job: Pick<JobData, "educationLevel" | "workExperienceYears">;
  styles: FieldStyleProps;
};

export function JobRequirementsSection({ job, styles }: JobRequirementsSectionProps) {
  const { iconSize, dtClass, ddClass } = styles;

  return (
    <>
      {job.educationLevel && (
        <div>
          <dt className={dtClass}>
            <GraduationCap className={iconSize} /> Opleidingsniveau
          </dt>
          <dd className={ddClass}>{job.educationLevel}</dd>
        </div>
      )}
      {job.workExperienceYears && (
        <div>
          <dt className={dtClass}>
            <Briefcase className={iconSize} /> Werkervaring
          </dt>
          <dd className={ddClass}>{job.workExperienceYears} jaar</dd>
        </div>
      )}
    </>
  );
}
