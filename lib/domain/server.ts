import { database } from '../../db/client';
import { createDomainUnitOfWork } from '../../db/domain-repository.ts';
import { createDomainService } from './service.ts';
export function domainService() { return createDomainService(createDomainUnitOfWork(database())); }
