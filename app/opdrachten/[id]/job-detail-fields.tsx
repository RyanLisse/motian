import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Euro,
  FileText,
  GraduationCap,
  Hash,
  MapPin,
  Monitor,
  Users,
} from "lucide-react";

const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};

type JobData = {
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

type JobDetailFieldsProps = {
  job: JobData;
  /** Extra condition key-value pairs from parsed conditions */
  metaFields?: [string, string][];
  /** "mobile" uses compact 2-col grid, "desktop" uses vertical list */
  variant: "mobile" | "desktop";
};

function DateDisplay({ date, format }: { date: Date; format: "short" | "long" }) {
  const options: Intl.DateTimeFormatOptions =
    format === "short"
      ? { day: "numeric", month: "short", year: "numeric" }
      : { day: "numeric", month: "long", year: "numeric" };
  return <>{new Date(date).toLocaleDateString("nl-NL", options)}</>;
}

function DeadlineBadge({ deadline }: { deadline: Date }) {
  if (new Date(deadline) >= new Date()) return null;
  return (
    <span className="text-[10px] font-semibold text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950 px-1.5 py-0.5 rounded">
      Verlopen
    </span>
  );
}

export function JobDetailFields({ job, metaFields = [], variant }: JobDetailFieldsProps) {
  const isMobile = variant === "mobile";
  const iconSize = isMobile ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5";
  const dateFormat = isMobile ? "short" : "long";

  const dtClass = isMobile
    ? "text-muted-foreground text-xs mb-0.5 flex items-center gap-1"
    : "text-muted-foreground text-xs mb-0.5 flex items-center gap-1.5";
  const ddClass = isMobile ? "text-foreground text-xs" : "text-foreground";
  const ddFontClass = isMobile
    ? "text-foreground font-medium text-xs"
    : "text-foreground font-medium";

  const rateDisplay =
    job.rateMin && job.rateMax
      ? `EUR ${job.rateMin} - ${job.rateMax}`
      : job.rateMax
        ? `max EUR ${job.rateMax}`
        : job.rateMin
          ? `min EUR ${job.rateMin}`
          : null;

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
      {job.extensionPossible !== null && (
        <div>
          <dt className={dtClass}>
            <Calendar className={iconSize} /> {isMobile ? "Verlenging" : "Verlenging mogelijk"}
          </dt>
          <dd className={ddClass}>{job.extensionPossible ? "Ja" : "Nee"}</dd>
        </div>
      )}
      {job.applicationDeadline && (
        <div>
          <dt className={dtClass}>
            <Clock className={iconSize} /> Deadline
          </dt>
          <dd className={`${ddClass} flex items-center gap-1.5`}>
            <DateDisplay date={job.applicationDeadline} format={dateFormat} />
            <DeadlineBadge deadline={job.applicationDeadline} />
          </dd>
        </div>
      )}
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
      {/* Desktop-only fields */}
      {!isMobile && (job.externalId || job.clientReferenceCode) && (
        <div>
          <dt className={dtClass}>
            <Hash className={iconSize} /> Referentiecode
          </dt>
          <dd className="text-foreground font-mono text-xs">
            {job.clientReferenceCode || job.externalId}
          </dd>
        </div>
      )}
      {!isMobile && job.allowsSubcontracting !== null && (
        <div>
          <dt className={dtClass}>
            <FileText className={iconSize} /> Onderaanneming
          </dt>
          <dd className={ddClass}>{job.allowsSubcontracting ? "Toegestaan" : "Niet toegestaan"}</dd>
        </div>
      )}
      {!isMobile &&
        metaFields.map(([label, value]) => (
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
