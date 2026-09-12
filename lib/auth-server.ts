import { privacyErrorResponse } from "./privacy-error";
import { verifyToken } from "@clerk/backend";
import { resolveInternalUser } from "../db/auth-store";

export class AuthError extends Error {
  status: number;
  code: string;
  constructor(status = 401, code = "UNAUTHENTICATED") {
    super(status === 401 ? "ログインしてください。" : status === 409 ? "アカウントが変更されました。再読み込みしてください。" : "認証を確認できません。時間をおいて再試行してください。");
    this.status = status; this.code = code;
  }
}

export function authErrorResponse(error: unknown): Response | undefined {
  const privacy = privacyErrorResponse(error); if (privacy) return privacy;
  if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store", "X-Patch-Auth-Error": error.code } });
}

export async function verifiedIdentity(request: Request) {
  const authorization = request.headers.get("authorization");
  const cookies = (request.headers.get("cookie") || "").split(";").map(v => v.trim()).filter(v => v.startsWith("__session="));
  if (cookies.length > 1) throw new AuthError();
  const cookie = cookies[0]?.slice("__session=".length);
  const bearer = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (authorization && !bearer) throw new AuthError();
  if (bearer && cookie && cookie !== bearer) throw new AuthError();
  const token = bearer || cookie;
  if (!token) throw new AuthError();
  const issuer = process.env.CLERK_ISSUER;
  const origins = process.env.AUTH_ALLOWED_ORIGINS?.split(",").map(v => v.trim()).filter(Boolean);
  if (!issuer || !origins?.length || !(process.env.CLERK_JWT_KEY || process.env.CLERK_SECRET_KEY)) throw new AuthError(503, "AUTH_NOT_CONFIGURED");
  let claims;
  try {
    // Native sessions may omit azp. Browser sessions must have an allowlisted azp.
    claims = await verifyToken(token, { jwtKey: process.env.CLERK_JWT_KEY, secretKey: process.env.CLERK_SECRET_KEY, clockSkewInMs: 5000 });
  } catch { throw new AuthError(); }
  if (claims.iss !== issuer || !claims.sub?.startsWith("user_") || !claims.sid?.startsWith("sess_") || claims.sts === "pending" || claims.act) throw new AuthError();
  if ((!bearer || claims.azp) && (!claims.azp || !origins.includes(claims.azp))) throw new AuthError();
  // Cookies are ambient credentials. Reject cross-site mutations, including subdomains.
  if (!bearer && !["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || !origins.includes(origin)) throw new AuthError(403, "INVALID_ORIGIN");
  }
  if (request.headers.get("x-patch-session") !== claims.sid) throw new AuthError(409, "ACCOUNT_CHANGED");
  return { issuer: claims.iss, subject: claims.sub, sessionId: claims.sid, claims };
}

export async function requireAuth(request: Request, bootstrap = false) {
  const identity = await verifiedIdentity(request);
  const claims = {iss:identity.issuer,sub:identity.subject,sid:identity.sessionId};
  const userId = await resolveInternalUser(claims.iss, claims.sub);
  if (!bootstrap && request.headers.get("x-patch-account") !== userId) throw new AuthError(409, "ACCOUNT_CHANGED");
  return { userId, subject: claims.sub, sessionId: claims.sid };
}
