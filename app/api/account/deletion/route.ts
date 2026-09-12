import {requireAuth,verifiedIdentity,authErrorResponse} from "../../../../lib/auth-server";
import {InputError,readJsonObject} from "../../../../lib/api-input";
import {createDeletionChallenge,requestDeletion,deletionStatus} from "../../../../db/account-deletion";
export const runtime="nodejs";export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request) {try{return json(await deletionStatus(request.headers.get("x-deletion-receipt")||""));}catch(e){return authErrorResponse(e)||(e instanceof InputError ? Response.json({error:e.message},{status:e.status}) : null)||json({error:"Unavailable"},503);}}
export async function POST(request:Request) {try {
 const b=await readJsonObject(request),auth=await verifiedIdentity(request);
 if(b.action==="challenge") {const {userId}=await requireAuth(request);return json(await createDeletionChallenge(userId,auth));}
 return json(await requestDeletion(auth,{challengeId:String(b.challengeId||""),operationId:String(b.operationId||""),receipt:String(b.receipt||"")}),202);
}catch(e){return authErrorResponse(e)||(e instanceof InputError ? Response.json({error:e.message},{status:e.status}) : null)||json({error:"Deletion unavailable"},503);}}
