export class PrivacyError extends Error {
  code: string; status: number;
  constructor(code: string, status = 409) { super(code); this.code=code; this.status=status; }
}
export function privacyErrorResponse(error: unknown) {
  if (error instanceof PrivacyError) return Response.json({ code: error.code, error: error.code }, { status: error.status, headers: { "Cache-Control": "no-store", ...(error.code.startsWith("ACCOUNT_") ? {"X-Patch-Auth-Error": error.code} : {}) } });
}
