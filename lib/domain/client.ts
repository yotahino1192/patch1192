import type { ApiTransport } from '../api-client.ts';
import type { CommandResults, DomainCommand, DomainQuery, QueryResults } from './types.ts';
/** Pass the existing authenticated/account-scoped transport. Do not pass unscoped fetch. */
export function createDomainClient(request:ApiTransport) {
  async function send<T>(url:string,init?:RequestInit):Promise<T> {
    const response=await request(url,init);
    if(!response.ok){const body:unknown=await response.json().catch(()=>({}));throw Object.assign(new Error(body&&typeof body==='object'&&'code' in body&&typeof body.code==='string'?body.code:'DOMAIN_REQUEST_FAILED'),{status:response.status});}
    return response.json() as Promise<T>;
  }
  return {
    command<C extends DomainCommand>(command:C):Promise<CommandResults[C['action']]> {return send('/api/domain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});},
    query<Q extends DomainQuery>(query:Q):Promise<QueryResults[Q['resource']]> {return send(`/api/domain?${new URLSearchParams(query)}`);},
  };
}
