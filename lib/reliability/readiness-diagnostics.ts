// Closed vocabulary only. Never accept an Error, provider message, SQL or config.
export type ReadinessStage = 'configuration' | 'database' | 'migration' | 'schema' | 'total';
export type ReadinessOutcome = 'ok' | 'failed' | 'timeout';
export type ReadinessReporter = (stage: ReadinessStage, outcome: ReadinessOutcome, durationMs: number) => void;
export type ReadinessMeasure = <T>(stage: ReadinessStage, action: () => T | Promise<T>) => Promise<T>;
export const readinessDiagnostic: ReadinessReporter = (stage, outcome, durationMs) => {
    if (!['configuration', 'database', 'migration', 'schema', 'total'].includes(stage) ||
        !['ok', 'failed', 'timeout'].includes(outcome) || !Number.isFinite(durationMs) || durationMs < 0) return;
    try { console.info(JSON.stringify({event: 'readiness', stage, outcome, durationMs: Math.round(durationMs)})); }
    catch { /* Diagnostics cannot affect readiness. */ }
};
export function readinessMeasure(report: ReadinessReporter = readinessDiagnostic): ReadinessMeasure {
    return async (stage, action) => {
        const start = performance.now();
        let outcome: ReadinessOutcome = 'failed';
        try { const result = await action(); outcome = 'ok'; return result; }
        finally { try { report(stage, outcome, performance.now() - start); } catch { /* Safe even with a failing sink. */ } }
    };
}
