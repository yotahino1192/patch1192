import {observeRoute} from '../../../lib/reliability/server';
export const dynamic='force-dynamic';
export const GET=observeRoute(async()=>Response.json({status:'ok'}));
