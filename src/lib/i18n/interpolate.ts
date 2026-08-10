/**
 * Minimal `{placeholder}` interpolation for dictionary strings.
 *
 * Deliberately not ICU MessageFormat: KHEM's chrome has no plural or gender
 * agreement to resolve, and neither language needs one today. If that changes
 * (Arabic has six plural forms), replace this with `Intl.PluralRules` rather
 * than growing the syntax here.
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
