export function buildGenerationError(code: string, kind = ''): string {
  if (['AI_CONSENT_REQUIRED', 'AI_CONSENT_CHANGED'].includes(code)) return 'AI consent is required. Review your AI consent in account settings, then retry.';
  if (['AI_UNKNOWN', 'AI_PREVIOUS_UNRESOLVED'].includes(code)) return 'Your previous generation could not be confirmed yet. An administrator must resolve it before you can generate again. Retry checks its status without resending it.';
  if (['AI_IN_PROGRESS', 'AI_CONCURRENCY_LIMIT'].includes(code)) return 'An AI operation is still in progress. Wait for it to finish, then retry.';
  if (code === 'AI_INPUT_TOO_LARGE') return 'This material exceeds the AI processing limit. Go back and use a shorter excerpt.';
  if (['AI_RATE_LIMIT', 'AI_COST_LIMIT'].includes(code)) return 'The AI usage limit has been reached. Please try again after the limit resets.';
  if (code === 'AI_REQUEST_FINAL') return 'Your previous generation has been resolved. Choose Generate again to start a new request.';
  if (code === 'AI_INVALID_GENERATED_CONTENT') return 'The AI returned study content that could not be used. Your material and settings are saved. Choose Generate again to start a new request.';
  if (code === 'AI_PROVIDER_FAILED') return 'The AI service could not complete generation. Your material is still here. Choose Generate again to start a new request.';
  if (code === 'AI_NOT_CONFIGURED') return 'The AI service is not configured. Please contact the administrator.';
  if (['UNAUTHORIZED', 'AUTH_REQUIRED'].includes(code)) return 'Please sign in again before generating your Patch.';
  if (['offline', 'timeout', 'network'].includes(kind)) return 'The connection was interrupted before generation could be confirmed. Reconnect, then retry to check the same request safely.';
  return 'We could not confirm generation. Your material is still here. Retry to check the request safely.';
}
