/** Capacitor iOS uses connectTimeout ?? readTimeout for URLRequest's entire
 * idle wait, including the first response byte. Allow the 45s provider deadline
 * plus API finalization; the outer AI request deadline remains 75s. */
export function nativeHttpTimeouts(platform: string, url: string, method = 'GET') {
  const ai = method.toUpperCase() === 'POST' && /^\/api\/ai\/(cards|chat)$/.test(new URL(url).pathname);
  return { connectTimeout: platform === 'ios' && ai ? 65000 : 15000, readTimeout: 65000 };
}
