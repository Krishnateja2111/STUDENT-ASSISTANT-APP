/**
 * A course's short code the way people actually say it — "CS 401",
 * "MATH 301" — pulled from the front of the course name (handles "CS401",
 * "CS-401", "MATH 301A" too). For a free-form name with no code at the
 * front it falls back to a compact initialism ("Organic Chemistry Lab" →
 * "OCL", "Image Processing" → "IP").
 */
export function courseCode(name: string): string {
  const trimmed = name.trim();
  const codeMatch = /^([A-Za-z]{2,5})[\s-]*(\d{2,4}[A-Za-z]?)\b/.exec(trimmed);
  if (codeMatch) {
    return `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}`;
  }
  const title = trimmed.split(/[–—:-]/)[0].trim() || trimmed;
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return (words[0] ?? trimmed).slice(0, 4).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
