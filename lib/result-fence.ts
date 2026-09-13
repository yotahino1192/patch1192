/** Invalidates in-flight results even if the underlying native transport ignores AbortSignal. */
export function createResultFence() {
  let revision = 0;
  return {
    invalidate() { revision++; },
    capture() {
      const started = revision;
      return () => {
        if (started !== revision) throw new Error('AI_RESULT_INVALIDATED');
      };
    },
  };
}
