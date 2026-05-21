/**
 * Location naming normalization and standardization.
 * Maps location variants to consistent formatting for analytics grouping.
 */

/**
 * Normalize a location name for analytics grouping.
 * - Trims whitespace
 * - Consistent title casing
 * - Removes common redundant suffixes
 */
export function normalizeLocationName(input: string): string {
  if (!input) return "";

  const trimmed = input.trim();
  if (!trimmed) return "";

  // Remove common redundant lake/river type suffixes (case-insensitive)
  // e.g., "Lake Michigan Lake" -> "Lake Michigan"
  let normalized = trimmed;
  const suffixPatterns = [
    /\s+(lake|river|creek|stream|pond|reservoir|bay|gulf|ocean|sea)(\s+\1)*$/i,
  ];

  for (const pattern of suffixPatterns) {
    normalized = normalized.replace(pattern, "");
  }

  return titleCase(normalized.trim());
}

/**
 * Format a location name for display (more user-friendly output).
 * Currently same as normalize, but kept separate for future enhancement
 * (e.g., adding state/country abbreviations, coordinates, etc.).
 */
export function formatLocationForDisplay(input: string): string {
  return normalizeLocationName(input);
}

/**
 * Check if two locations represent the same place (after normalization)
 */
export function isSameLocation(a: string, b: string): boolean {
  return normalizeLocationName(a) === normalizeLocationName(b);
}

/**
 * Trim location name for storage (minimal processing)
 * Used when saving location to database to ensure consistency
 */
export function trimLocationForStorage(input: string): string {
  if (!input) return "";
  const trimmed = input.trim().replace(/\s+/g, " ");
  // Preserve user's original casing for storage
  return trimmed;
}

/**
 * Title case utility
 */
function titleCase(str: string): string {
  return str
    .split(/\s+/)
    .map((word) => {
      // Skip articles and prepositions in title case
      const lowerWord = word.toLowerCase();
      if (
        ["and", "or", "of", "the", "a", "an", "in", "on", "at", "to"].includes(
          lowerWord
        )
      ) {
        return lowerWord;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .map((word, idx) => (idx === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}
