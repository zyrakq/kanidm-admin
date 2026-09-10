// Recycle bin view models mapped from Kanidm v1 entries. Wire shapes
// mirror kanidm_proto (verified against vendor sources): attrs are
// snake_case keys with list values.

import type { KanidmEntry } from '@/shared/types/kanidm';
import { attrFirst, attrList } from '@/shared/types/kanidm';

/** Row model for the recycle bin list. */
export interface RecycleBinEntry {
  id: string;
  uuid: string | null;
  classes: string[];
}

/** Map a v1 entry to the recycle bin row (attrs name, uuid, class). */
export function toRecycleBinEntry(entry: KanidmEntry): RecycleBinEntry {
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    uuid: attrFirst(entry, 'uuid') ?? null,
    classes: attrList(entry, 'class'),
  };
}
