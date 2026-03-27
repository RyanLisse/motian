export function DateDisplay({ date, format }: { date: Date; format: "short" | "long" }) {
  const options: Intl.DateTimeFormatOptions =
    format === "short"
      ? { day: "numeric", month: "short", year: "numeric" }
      : { day: "numeric", month: "long", year: "numeric" };
  return <>{new Date(date).toLocaleDateString("nl-NL", options)}</>;
}

export function DeadlineBadge({ deadline }: { deadline: Date }) {
  if (new Date(deadline) >= new Date()) return null;
  return (
    <span className="text-[10px] font-semibold text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950 px-1.5 py-0.5 rounded">
      Verlopen
    </span>
  );
}
