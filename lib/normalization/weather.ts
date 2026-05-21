/**
 * Weather condition normalization and standardization.
 * Maps user input and variants to standard weather buckets for consistent analytics grouping.
 */

export const WEATHER_BUCKETS = {
  SUNNY: "Sunny",
  PARTLY_CLOUDY: "Partly Cloudy",
  CLOUDY: "Cloudy",
  RAIN: "Rain",
  THUNDERSTORMS: "Thunderstorms",
  FOG: "Fog",
  SNOW: "Snow",
  WINDY: "Windy",
} as const;

export type WeatherBucket = typeof WEATHER_BUCKETS[keyof typeof WEATHER_BUCKETS];

/**
 * All valid weather options for autocomplete/selection
 */
export const WEATHER_OPTIONS: WeatherBucket[] = [
  WEATHER_BUCKETS.SUNNY,
  WEATHER_BUCKETS.PARTLY_CLOUDY,
  WEATHER_BUCKETS.CLOUDY,
  WEATHER_BUCKETS.RAIN,
  WEATHER_BUCKETS.THUNDERSTORMS,
  WEATHER_BUCKETS.FOG,
  WEATHER_BUCKETS.SNOW,
  WEATHER_BUCKETS.WINDY,
];

/**
 * Mapping of common variants/typos to canonical weather buckets
 * Used for normalizing user input and preventing analytics fragmentation
 */
const WEATHER_ALIASES: Record<string, WeatherBucket> = {
  // Sunny variants
  sunny: WEATHER_BUCKETS.SUNNY,
  clear: WEATHER_BUCKETS.SUNNY,
  "clear skies": WEATHER_BUCKETS.SUNNY,
  "clear sky": WEATHER_BUCKETS.SUNNY,

  // Partly Cloudy variants
  "partly cloudy": WEATHER_BUCKETS.PARTLY_CLOUDY,
  "partially cloudy": WEATHER_BUCKETS.PARTLY_CLOUDY,
  "part cloudy": WEATHER_BUCKETS.PARTLY_CLOUDY,
  "partly clouds": WEATHER_BUCKETS.PARTLY_CLOUDY,
  "some clouds": WEATHER_BUCKETS.PARTLY_CLOUDY,

  // Cloudy variants
  cloudy: WEATHER_BUCKETS.CLOUDY,
  clouds: WEATHER_BUCKETS.CLOUDY,
  overcast: WEATHER_BUCKETS.CLOUDY,
  "dark cloudy": WEATHER_BUCKETS.CLOUDY,
  "heavily cloudy": WEATHER_BUCKETS.CLOUDY,

  // Rain variants
  rain: WEATHER_BUCKETS.RAIN,
  raining: WEATHER_BUCKETS.RAIN,
  rainy: WEATHER_BUCKETS.RAIN,
  "light rain": WEATHER_BUCKETS.RAIN,
  "heavy rain": WEATHER_BUCKETS.RAIN,
  drizzle: WEATHER_BUCKETS.RAIN,
  "light drizzle": WEATHER_BUCKETS.RAIN,

  // Thunderstorms variants
  thunderstorms: WEATHER_BUCKETS.THUNDERSTORMS,
  thunderstorm: WEATHER_BUCKETS.THUNDERSTORMS,
  "thunder storms": WEATHER_BUCKETS.THUNDERSTORMS,
  "heavy thunderstorm": WEATHER_BUCKETS.THUNDERSTORMS,
  "severe thunderstorm": WEATHER_BUCKETS.THUNDERSTORMS,
  lightning: WEATHER_BUCKETS.THUNDERSTORMS,
  "thunder and lightning": WEATHER_BUCKETS.THUNDERSTORMS,
  "storms": WEATHER_BUCKETS.THUNDERSTORMS,

  // Fog variants
  fog: WEATHER_BUCKETS.FOG,
  foggy: WEATHER_BUCKETS.FOG,
  mist: WEATHER_BUCKETS.FOG,
  misty: WEATHER_BUCKETS.FOG,
  haze: WEATHER_BUCKETS.FOG,
  hazy: WEATHER_BUCKETS.FOG,

  // Snow variants
  snow: WEATHER_BUCKETS.SNOW,
  snowing: WEATHER_BUCKETS.SNOW,
  snowy: WEATHER_BUCKETS.SNOW,
  sleet: WEATHER_BUCKETS.SNOW,
  hail: WEATHER_BUCKETS.SNOW,
  "snow/sleet": WEATHER_BUCKETS.SNOW,

  // Windy variants
  windy: WEATHER_BUCKETS.WINDY,
  wind: WEATHER_BUCKETS.WINDY,
  "high wind": WEATHER_BUCKETS.WINDY,
  "strong wind": WEATHER_BUCKETS.WINDY,
  "gusty winds": WEATHER_BUCKETS.WINDY,
  "high winds": WEATHER_BUCKETS.WINDY,
};

/**
 * Normalize a weather condition string to a standard bucket.
 * Handles variant spellings, typos, and common aliases.
 * Returns original input if no match found, but trimmed and title-cased.
 */
export function normalizeWeatherCondition(input: string): string {
  if (!input) return "";

  const normalized = input.trim().toLowerCase();
  if (!normalized) return "";

  // Check exact alias match first
  if (WEATHER_ALIASES[normalized]) {
    return WEATHER_ALIASES[normalized];
  }

  // Check if input already matches a standard bucket (case-insensitive)
  const bucket = WEATHER_OPTIONS.find(
    (b) => b.toLowerCase() === normalized
  );
  if (bucket) return bucket;

  // Fallback: return original input trimmed and title-cased
  return titleCase(normalized);
}

/**
 * Parse weather input and return the normalized weather condition.
 * This is the same as normalizeWeatherCondition but with more explicit intent.
 */
export function parseWeatherInput(input: string): string {
  return normalizeWeatherCondition(input);
}

/**
 * Check if two weather conditions represent the same bucket
 * (after normalization)
 */
export function isSameWeather(a: string, b: string): boolean {
  return normalizeWeatherCondition(a) === normalizeWeatherCondition(b);
}

/**
 * Title case utility
 */
function titleCase(str: string): string {
  return str
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
