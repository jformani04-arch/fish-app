/**
 * Lure naming normalization and standardization.
 * Handles deduplication and suggestion prioritization.
 */

/**
 * Normalize a lure name for analytics grouping.
 * - Trims whitespace
 * - Consistent title casing
 */
export function normalizeLureName(input: string): string {
  if (!input) return "";

  const trimmed = input.trim();
  if (!trimmed) return "";

  return titleCase(trimmed);
}

/**
 * Check if two lure names represent the same lure (after normalization)
 */
export function isSameLure(a: string, b: string): boolean {
  return normalizeLureName(a) === normalizeLureName(b);
}

/**
 * Check if two lure names are likely the same using fuzzy matching.
 * Returns true if similarity is high (> 85%).
 */
export function isSimilarLure(a: string, b: string): boolean {
  const normA = normalizeLureName(a).toLowerCase();
  const normB = normalizeLureName(b).toLowerCase();

  if (normA === normB) return true;

  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  const similarity = 1 - distance / maxLen;

  return similarity > 0.85;
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching to detect typos/variations.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Title case utility
 */
function titleCase(str: string): string {
  return str
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
