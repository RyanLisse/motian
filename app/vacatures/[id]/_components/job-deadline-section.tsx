import { Clock } from "lucide-react";
import { DateDisplay, DeadlineBadge } from "./date-display";
import type { FieldStyleProps, JobData } from "./job-field-types";

type JobDeadlineSectionProps = {
  job: Pick<JobData, "applicationDeadline">;
  styles: FieldStyleProps;
};

export function JobDeadlineSection({ job, styles }: JobDeadlineSectionProps) {
  const { iconSize, dtClass, ddClass, dateFormat } = styles;

  if (!job.applicationDeadline) return null;

  return (
    <div>
      <dt className={dtClass}>
        <Clock className={iconSize} /> Deadline
      </dt>
      <dd className={`${ddClass} flex items-center gap-1.5`}>
        <DateDisplay date={job.applicationDeadline} format={dateFormat} />
        <DeadlineBadge deadline={job.applicationDeadline} />
      </dd>
    </div>
  );
}
