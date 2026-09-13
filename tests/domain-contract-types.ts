import type { ActivityType } from '../lib/domain/types';
import type { activities } from '../db/domain-schema';
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true> = T;
/** Compile-time regression: neither the public contract nor DB insert type can broaden to string. */
export type ActivityContractIsClosed = Assert<Equal<ActivityType,'LEARN'|'RECALL'|'CHOICE'|'EXPLAIN'|'APPLY'>>;
export type DatabaseActivityContractIsClosed = Assert<Equal<typeof activities.$inferInsert.type,ActivityType>>;
