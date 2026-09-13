import { asFailure, retryPolicy } from './reliability/errors.ts';
import { acceptsPendingLink } from './continue-learning.ts';
import { parseDeepLink } from './retention.ts';
export type PendingDeepLink = { url: string; at: number; owner?: string };
/** Account-scoped inbox: a transient API failure must not consume an intent. */
export class PendingDeepLinks {
  private items: PendingDeepLink[] = [];
  private failures = 0;
  private retryAt = 0;
  private readonly owner: string;
  constructor(owner: string) { this.owner = owner; }
  enqueue(links: PendingDeepLink[], now: number) {
    this.items = this.items.filter(link => acceptsPendingLink(link, this.owner, now));
    for (const link of links) {
      if (!acceptsPendingLink(link, this.owner, now) || !parseDeepLink(link.url)) continue;
      if (!this.items.some(item => item.url === link.url && item.at === link.at && item.owner === link.owner)) this.items.push(link);
    }
    this.items = this.items.slice(-16);
  }
  next(now: number) {
    this.enqueue([], now);
    return now >= this.retryAt ? this.items[0] : undefined;
  }
  complete(link: PendingDeepLink) {
    this.items = this.items.filter(item => item !== link);
    this.failures = 0; this.retryAt = 0;
  }
  retry(now: number, minimumDelayMs = 0) {
    this.retryAt = now + Math.max(minimumDelayMs, Math.min(30000, 1000 * 2 ** Math.min(this.failures++, 5)));
  }
  handleFailure(error: unknown, now: number) {
    const policy = retryPolicy(asFailure(error), 'GET');
    if (policy.manual) this.retry(now, policy.delayMs);
    else { this.items = []; this.failures = 0; this.retryAt = 0; }
  }
}
