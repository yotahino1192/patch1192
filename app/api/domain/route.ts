import { observeRoute } from '../../../lib/reliability/server';
import { requireAuth, authErrorResponse } from '../../../lib/auth-server';
import { InputError, readJsonObject } from '../../../lib/api-input';
import { domainService } from '../../../lib/domain/server';
import { DomainError, validateCommand, validateQuery } from '../../../lib/domain/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request:Request) {
 try {
  const {userId}=await requireAuth(request);
  const service=domainService();
  if(request.method==='POST')return json(await service.command(userId,validateCommand(await readJsonObject(request,256*1024))));
  const params=new URL(request.url).searchParams;
  if([...params.keys()].some(key=>params.getAll(key).length!==1))throw new DomainError('INVALID_DOMAIN_QUERY');
  return json(await service.query(userId,validateQuery(Object.fromEntries(params))));
 } catch(error) {
  return authErrorResponse(error)??(error instanceof DomainError?json({code:error.code},error.status):error instanceof InputError?json({error:error.message},error.status):json({code:'DOMAIN_UNAVAILABLE'},503));
 }
}
export const GET=observeRoute(handle);
export const POST=observeRoute(handle);
