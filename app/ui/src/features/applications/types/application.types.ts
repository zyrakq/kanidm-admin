// Application wire types and view models — SCIM-backed.
//
// Shapes verified against vendor/kanidm/proto/src/scim_v1/client.rs:
// - ScimEntryApplication (snake_case entry): header (camelCase
//   ScimEntryHeader: schemas, id, ...) flattened in, plus name,
//   displayname, linked_group: ScimReference[] and flattened attrs.
// - ScimListApplication (camelCase envelope): totalResults, resources.
// - ScimEntryApplicationPost (snake_case): name, displayname,
//   linked_group: ScimReference — a bare string converts via
//   ScimReference::from (uuid arm skipped, skip_serializing_none).
// NOTE: ScimEntryApplication carries NO url field — do not invent one.

/** Vendor ScimReference (client.rs:70): uuid/value, both optional. */
export interface ScimReference {
  uuid?: string;
  value?: string;
}

/** Vendor ScimEntryApplication (client.rs:158). */
export interface ScimEntryApplication {
  schemas: string[];
  id: string;
  name: string;
  displayname: string;
  linked_group: ScimReference[];
  /** Flattened attrs (BTreeMap<Attribute, JsonValue>). */
  [attr: string]: unknown;
}

/** Vendor ScimListApplication (client.rs:174) — camelCase envelope. */
export interface ScimListApplication {
  schemas: string[];
  totalResults: number;
  itemsPerPage?: number;
  startIndex?: number;
  resources: ScimEntryApplication[];
}

/** Vendor ScimEntryApplicationPost (client.rs:149). */
export interface ScimEntryApplicationPost {
  name: string;
  displayname: string;
  linked_group: { value: string };
}

/** Row model for the applications list. */
export interface ApplicationSummary {
  id: string;
  name: string;
  displayName: string;
  /** The `value` of each linked_group reference (group name). */
  linkedGroups: string[];
}

/** Full application detail (entry projected). */
export interface ApplicationDetail {
  id: string;
  name: string;
  displayName: string;
  linkedGroups: string[];
  /** Flattened attrs, values coerced to string arrays for display. */
  attrs: Record<string, string[]>;
  raw: ScimEntryApplication;
}

/** Extract the group-name values from a linked_group reference list. */
export function linkedGroupValues(entry: ScimEntryApplication): string[] {
  return (entry.linked_group ?? [])
    .map((ref) => ref.value)
    .filter((value): value is string => typeof value === 'string');
}

/** Coerce a flattened attr value to a displayable string array. */
function attrToStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === 'string' ? item : JSON.stringify(item)
    );
  }
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [JSON.stringify(value)];
}

/** Map a SCIM application entry to the summary row. */
export function toApplicationSummary(
  entry: ScimEntryApplication
): ApplicationSummary {
  return {
    id: entry.id,
    name: entry.name,
    displayName: entry.displayname,
    linkedGroups: linkedGroupValues(entry),
  };
}

/** Map a SCIM application entry to the detail model. */
export function toApplicationDetail(
  entry: ScimEntryApplication
): ApplicationDetail {
  const known = new Set(['schemas', 'id', 'name', 'displayname', 'linked_group']);
  const attrs: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!known.has(key)) {
      const strings = attrToStrings(value);
      if (strings.length > 0) {
        attrs[key] = strings;
      }
    }
  }
  return {
    id: entry.id,
    name: entry.name,
    displayName: entry.displayname,
    linkedGroups: linkedGroupValues(entry),
    attrs,
    raw: entry,
  };
}
