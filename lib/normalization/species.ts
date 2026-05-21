/**
 * Species normalization and standardization.
 * Handles deduplication, typo tolerance, and suggestion prioritization.
 */

/**
 * Normalize a species name for analytics grouping.
 * - Trims whitespace
 * - Consistent title casing
 * - Basic typo detection and correction
 */
export function normalizeSpeciesName(input: string): string {
  if (!input) return "";

  const trimmed = input.trim();
  if (!trimmed) return "";

  return titleCase(trimmed);
}

/**
 * Get the canonical/preferred name for a species.
 * Maps common aliases, typos, and variations to the canonical name.
 * Returns the input (title-cased) if no mapping exists.
 */
export function getCanonicalSpecies(input: string): string {
  const normalized = normalizeSpeciesName(input);

  // Common typo/alias mappings
  const aliases: Record<string, string> = {
    // Bass aliases
    Largemouth: "Largemouth Bass",
    Smallmouth: "Smallmouth Bass",
    Stripedstripe: "Striped Bass",
    Striped: "Striped Bass",
    Lr: "Largemouth Bass",
    Sm: "Smallmouth Bass",

    // Catfish aliases
    "Blue Catfish": "Blue Catfish",
    "Channel Catfish": "Channel Catfish",
    "Flathead Catfish": "Flathead Catfish",
    Catfish: "Catfish",

    // Pike aliases
    "Northern Pike": "Northern Pike",
    Pike: "Northern Pike",
    Pickerel: "Pickerel",

    // Trout aliases
    Rainbow: "Rainbow Trout",
    "Rainbow Trout": "Rainbow Trout",
    Brown: "Brown Trout",
    "Brown Trout": "Brown Trout",
    Brook: "Brook Trout",
    "Brook Trout": "Brook Trout",
    Cutthroat: "Cutthroat Trout",
    "Cutthroat Trout": "Cutthroat Trout",

    // Panfish aliases
    Bluegill: "Bluegill",
    "Bluegill Sunfish": "Bluegill",
    "Blue Gill": "Bluegill",
    Crappie: "Crappie",
    "Black Crappie": "Black Crappie",
    "White Crappie": "White Crappie",
    Perch: "Perch",
    "Yellow Perch": "Yellow Perch",

    // Walleye
    Walleye: "Walleye",
    Walleyed: "Walleye",

    // Carp
    Carp: "Carp",
    "Common Carp": "Common Carp",

    // Salmon
    Salmon: "Salmon",
    Chinook: "Chinook Salmon",
    Coho: "Coho Salmon",
    Pink: "Pink Salmon",
    Chum: "Chum Salmon",
  };

  return aliases[normalized] || normalized;
}

/**
 * Check if two species names are likely the same using Levenshtein distance.
 * Returns true if similarity is high (> 85%).
 */
export function isSimilarSpecies(a: string, b: string): boolean {
  const normA = normalizeSpeciesName(a).toLowerCase();
  const normB = normalizeSpeciesName(b).toLowerCase();

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
