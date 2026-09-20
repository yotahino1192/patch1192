import {initializeDatabase} from '../../../db/client';
import {observeRoute,readinessProbe} from '../../../lib/reliability/server';
import {operationEvent} from '../../../lib/operations';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ready=readinessProbe(initializeDatabase);
export const GET=observeRoute(async()=>{const ok=await ready();if(!ok)operationEvent('database_check','failed');return Response.json({status:ok?'ready':'unavailable'},{status:ok?200:503});});
