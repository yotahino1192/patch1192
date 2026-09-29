import {after} from 'next/server';
import {initializeReadinessDatabase} from '../../../db/client';
import {observeRoute,readinessProbe} from '../../../lib/reliability/server';
import {operationEvent} from '../../../lib/operations';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Lifetime budget for background completion; the HTTP deadline stays 2 seconds.
export const maxDuration=60;
const ready=readinessProbe(initializeReadinessDatabase);
export const GET=observeRoute(async()=>{const ok=await ready(work=>after(async()=>{await work;}));if(!ok)operationEvent('database_check','failed');return Response.json({status:ok?'ready':'unavailable'},{status:ok?200:503});});
