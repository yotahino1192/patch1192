import { requireAuth, authErrorResponse } from "../../../../lib/auth-server";
import { getConsent,setConsent } from "../../../../db/privacy-store";
import { CONSENT_VERSION,POLICY_VERSION } from "../../../../lib/privacy-policy";
import { InputError, readJsonObject } from "../../../../lib/api-input";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(body:unknown)=>Response.json(body,{headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request) { try {
 const {userId}=await requireAuth(request);const language=new URL(request.url).searchParams.get("language")==="en"?"en":"ja";
 return json({consent:await getConsent(userId,language),requiredVersion:CONSENT_VERSION,policyVersion:POLICY_VERSION});
} catch(e) { return authErrorResponse(e)||(e instanceof InputError ? Response.json({error:e.message},{status:e.status}) : null)||Response.json({error:"Privacy settings unavailable"},{status:503}); } }
export async function PUT(request:Request) { try {
 const {userId}=await requireAuth(request);const b=await readJsonObject(request);
 return json({consent:await setConsent(userId,{state:String(b.state),revision:Number(b.revision),operationId:String(b.operationId),consentVersion:String(b.consentVersion),policyVersion:String(b.policyVersion),textHash:String(b.textHash),language:b.language==="en"?"en":"ja"})});
} catch(e) { return authErrorResponse(e)||(e instanceof InputError ? Response.json({error:e.message},{status:e.status}) : null)||Response.json({error:"Privacy settings unavailable"},{status:503}); } }
