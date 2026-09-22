import { english } from '../lib/translations';

// Legacy validators return English messages. Adapt only system errors at the UI
// boundary; domain results, request payloads and user content stay untouched.
const errorKeys = new Map(Object.entries(english).map(([key, value]) => [value, key]));
export function localizeBuildError(message: string | undefined, t: (key: string) => string): string {
  return message ? t(errorKeys.get(message) || message) : '';
}
