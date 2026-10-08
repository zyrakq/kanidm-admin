// Shared wire shapes for Kanidm v1 entries returned by the proxy.
// Mirrors kanidm_proto::v1::Entry { attrs: BTreeMap<String, Vec<String>> }
// (verify against vendor libs/client usage when a shape is in doubt).

/** A Kanidm v1 entry: attribute name -> list of values. */
export interface KanidmEntry {
  attrs: Record<string, string[]>;
}

/** First value of an attribute, or undefined. */
export function attrFirst(
  entry: KanidmEntry,
  attr: string
): string | undefined {
  return entry.attrs[attr]?.[0];
}

/** All values of an attribute (empty array when absent). */
export function attrList(entry: KanidmEntry, attr: string): string[] {
  return entry.attrs[attr] ?? [];
}

/** True when the attribute exists with at least one value. */
export function hasAttr(entry: KanidmEntry, attr: string): boolean {
  return (entry.attrs[attr]?.length ?? 0) > 0;
}

/** Build the PATCH/POST entry body kanidm expects: { attrs: {...} }. */
export function entryBody(attrs: Record<string, string[]>): {
  attrs: Record<string, string[]>;
} {
  return { attrs };
}
