/**
 * Unified suggestion system for all field autocompletes.
 * Prioritizes user history over predefined lists for smarter suggestions.
 */

/**
 * Compute prioritized matches for a field query.
 * Returns suggestions in order of relevance:
 * 1. Exact matches from user history
 * 2. Prefix matches from user history
 * 3. Substring matches from user history
 * 4. Prefix matches from predefined options
 * 5. Substring matches from predefined options
 */
export function getPrioritizedSuggestions(
  query: string,
  userHistory: string[],
  predefinedOptions: string[],
  maxResults: number = 8
): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    // Empty query: show user history first, then predefined
    return [...userHistory, ...predefinedOptions].slice(0, maxResults);
  }

  const exactMatches: string[] = [];
  const prefixMatches: string[] = [];
  const substringMatches: string[] = [];

  // Prioritize user history
  for (const item of userHistory) {
    const itemLower = item.toLowerCase();
    if (itemLower === normalized) {
      exactMatches.push(item);
    } else if (itemLower.startsWith(normalized)) {
      prefixMatches.push(item);
    } else if (itemLower.includes(normalized)) {
      substringMatches.push(item);
    }
  }

  const result = [...exactMatches, ...prefixMatches, ...substringMatches];

  // If we have enough from history, return early
  if (result.length >= maxResults) {
    return result.slice(0, maxResults);
  }

  // Supplement with predefined options
  const predefinedPrefixMatches: string[] = [];
  const predefinedSubstringMatches: string[] = [];

  for (const item of predefinedOptions) {
    // Skip if already in result (case-insensitive)
    if (result.some((r) => r.toLowerCase() === item.toLowerCase())) {
      continue;
    }

    const itemLower = item.toLowerCase();
    if (itemLower.startsWith(normalized)) {
      predefinedPrefixMatches.push(item);
    } else if (itemLower.includes(normalized)) {
      predefinedSubstringMatches.push(item);
    }
  }

  result.push(...predefinedPrefixMatches, ...predefinedSubstringMatches);
  return result.slice(0, maxResults);
}

/**
 * Simple substring matching for quick autocomplete.
 * Used when we don't have user history or for quick local filtering.
 */
export function getMatches(query: string, options: string[], maxResults: number = 8): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options.slice(0, maxResults);
  return options
    .filter((option) => option.toLowerCase().includes(normalized))
    .slice(0, maxResults);
}

/**
 * Deduplicate a list of strings (case-insensitive)
 */
export function deduplicateCaseInsensitive(items: string[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}
