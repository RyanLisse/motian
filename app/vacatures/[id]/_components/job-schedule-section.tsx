import { Calendar, Clock } from "lucide-react";
import { DateDisplay } from "./date-display";
import type { FieldStyleProps, JobData } from "./job-field-types";

type JobScheduleSectionProps = {
  job: Pick<
    JobData,
    | "startDate"
    | "endDate"
    | "hoursPerWeek"
    | "minHoursPerWeek"
    | "durationMonths"
    | "extensionPossible"
  >;
  styles: FieldStyleProps;
};

export function JobScheduleSection({ job, styles }: JobScheduleSectionProps) {
  const { iconSize, dtClass, ddClass, dateFormat, isMobile } = styles;

  const hoursDisplay =
    job.minHoursPerWeek && job.hoursPerWeek
      ? `${job.minHoursPerWeek} - ${job.hoursPerWeek} uur`
      : job.hoursPerWeek
        ? `${job.hoursPerWeek} uur`
        : job.minHoursPerWeek
          ? `${job.minHoursPerWeek} uur (min)`
          : null;

  return (
    <>
      {job.startDate && (
        <div>
          <dt className={dtClass}>
            <Calendar className={iconSize} /> Startdatum
          </dt>
          <dd className={ddClass}>
            <DateDisplay date={job.startDate} format={dateFormat} />
          </dd>
        </div>
      )}
      {job.endDate && (
        <div>
          <dt className={dtClass}>
            <Calendar className={iconSize} /> Einddatum
          </dt>
          <dd className={ddClass}>
            <DateDisplay date={job.endDate} format={dateFormat} />
          </dd>
        </div>
      )}
      {hoursDisplay && (
        <div>
          <dt className={dtClass}>
            <Clock className={iconSize} /> Uren per week
          </dt>
          <dd className={ddClass}>{hoursDisplay}</dd>
        </div>
      )}
      {job.durationMonths && (
        <div>
          <dt className={dtClass}>
            <Calendar className={iconSize} /> Looptijd
          </dt>
          <dd className={ddClass}>{job.durationMonths} maanden</dd>
        </div>
      )}
      {job.extensionPossible !== null && (
        <div>
          <dt className={dtClass}>
            <Calendar className={iconSize} /> {isMobile ? "Verlenging" : "Verlenging mogelijk"}
          </dt>
          <dd className={ddClass}>{job.extensionPossible ? "Ja" : "Nee"}</dd>
        </div>
      )}
    </>
  );
}
