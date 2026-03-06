/**
 * Escape SQL LIKE/ILIKE special characters (%, _, \) in user input.
 * Prevents wildcard injection into search patterns.
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}
