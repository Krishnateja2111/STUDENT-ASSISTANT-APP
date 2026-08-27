/** Formats a minute count as "Xh Ym" / "Xh" / "Xm". */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}
