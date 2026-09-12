import {workerAuthorized,runDeletionJob} from "../../../../lib/deletion-worker";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
export async function POST(request:Request) {
 if(!workerAuthorized(request.headers.get("authorization"))) return Response.json({error:"Unauthorized"},{status:401});
 try{return Response.json(await runDeletionJob(),{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"Worker unavailable"},{status:503});}
}
