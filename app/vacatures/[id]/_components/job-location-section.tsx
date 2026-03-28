import { MapPin, Monitor } from "lucide-react";
import { arrangementLabels, type FieldStyleProps, type JobData } from "./job-field-types";

type JobLocationSectionProps = {
  job: Pick<JobData, "location" | "workArrangement">;
  styles: FieldStyleProps;
};

export function JobLocationSection({ job, styles }: JobLocationSectionProps) {
  const { iconSize, dtClass, ddClass } = styles;

  return (
    <>
      {job.location && (
        <div>
          <dt className={dtClass}>
            <MapPin className={iconSize} /> Locatie
          </dt>
          <dd className={ddClass}>{job.location}</dd>
        </div>
      )}
      {job.workArrangement && (
        <div>
          <dt className={dtClass}>
            <Monitor className={iconSize} /> Werkwijze
          </dt>
          <dd className={ddClass}>
            {arrangementLabels[job.workArrangement] ?? job.workArrangement}
          </dd>
        </div>
      )}
    </>
  );
}
