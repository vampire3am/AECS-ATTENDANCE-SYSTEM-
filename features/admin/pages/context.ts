import type { Actor } from '@/lib/auth/permissions';
import type { catalog } from '@/lib/services/queries';
export type Search = Record<string, string | string[] | undefined>;
export type PageContext = {
  actor: Actor;
  q: Search;
  id?: string;
  tab?: string;
  c: Awaited<ReturnType<typeof catalog>>;
};
