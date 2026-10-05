const icons = import.meta.glob('../assets/poi/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Hashed URL of a POI icon file in src/assets/poi/. */
export function poiIconUrl(file: string): string | null {
  return icons[`../assets/poi/${file}`] ?? null;
}
