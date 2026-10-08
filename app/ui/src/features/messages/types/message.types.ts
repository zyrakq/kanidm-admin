// Messages view models mapped from the SCIM Message entries. Wire shapes
// mirror kanidm_proto (verified against vendor sources):
// - ScimEntryMessage is snake_case, but its flattened ScimEntryHeader is
//   camelCase (schemas, id, externalId, meta).
// - message_template is an externally-tagged enum (OutboundMessage):
//   { TestMessageV1: { display_name } } or { CredentialResetV1:
//   { display_name, intent_id, expiry_time } } — expiry_time is unix secs.
// - send_after / delete_after / sent_at are RFC3339 STRINGS (ScimDateTime
//   is #[serde(transparent)]).
// - mail_destination is [{ primary, value }] (ScimMail, camelCase).
// - The list envelope is camelCase: { totalResults, resources }.

/** One mail destination (ScimMail). */
export interface ScimMailWire {
  primary: boolean;
  value: string;
}

/** Flattened ScimEntryHeader (camelCase). */
export interface ScimEntryHeaderWire {
  schemas: string[];
  id: string;
  externalId?: string;
  meta?: {
    resourceType: string;
    created: string;
    lastModified: string;
    location: string;
    version: string;
  };
}

/** OutboundMessage template (externally-tagged enum). */
export type OutboundMessageWire =
  | { TestMessageV1: { display_name: string } }
  | {
      CredentialResetV1: {
        display_name: string;
        intent_id: string;
        /** Unix timestamp in seconds. */
        expiry_time: number;
      };
    };

/** Raw SCIM Message entry (ScimEntryMessage, snake_case body). */
export interface ScimEntryMessageWire {
  schemas: string[];
  id: string;
  externalId?: string;
  meta?: ScimEntryHeaderWire['meta'];
  message_template: OutboundMessageWire;
  send_after: string;
  delete_after: string;
  sent_at: string | null;
  mail_destination: ScimMailWire[];
}

/** SCIM list envelope (ScimListMessage, camelCase). */
export interface ScimListMessageWire {
  schemas: string[];
  totalResults: number;
  itemsPerPage?: number;
  startIndex?: number;
  resources: ScimEntryMessageWire[];
}

/** Row model for the messages list. */
export interface MessageSummary {
  id: string;
  /** 'test_message_v1' | 'credential_reset_v1' */
  templateType: string;
  displayName: string;
  sendAfter: string;
  sentAt: string | null;
  mailDestination: string;
}

/** Full message detail (entry projected). */
export interface MessageDetail {
  id: string;
  template: OutboundMessageWire;
  templateType: string;
  displayName: string;
  intentId: string | null;
  /** Unix seconds, credential reset only. */
  expiryTime: number | null;
  sendAfter: string;
  deleteAfter: string;
  sentAt: string | null;
  mailDestination: ScimMailWire[];
}

/** Extract the variant tag of an OutboundMessage wire value. */
export function templateType(template: OutboundMessageWire): string {
  if ('TestMessageV1' in template) {
    return 'test_message_v1';
  }
  return 'credential_reset_v1';
}

/** Extract the display name of an OutboundMessage wire value. */
export function templateDisplayName(template: OutboundMessageWire): string {
  if ('TestMessageV1' in template) {
    return template.TestMessageV1.display_name;
  }
  return template.CredentialResetV1.display_name;
}

/** Map a raw SCIM entry to the summary row. */
export function toMessageSummary(entry: ScimEntryMessageWire): MessageSummary {
  return {
    id: entry.id,
    templateType: templateType(entry.message_template),
    displayName: templateDisplayName(entry.message_template),
    sendAfter: entry.send_after,
    sentAt: entry.sent_at,
    mailDestination: entry.mail_destination
      .map((mail) => mail.value)
      .join(', '),
  };
}

/** Map a raw SCIM entry to the detail model. */
export function toMessageDetail(entry: ScimEntryMessageWire): MessageDetail {
  const reset =
    'CredentialResetV1' in entry.message_template
      ? entry.message_template.CredentialResetV1
      : null;
  return {
    id: entry.id,
    template: entry.message_template,
    templateType: templateType(entry.message_template),
    displayName: templateDisplayName(entry.message_template),
    intentId: reset ? reset.intent_id : null,
    expiryTime: reset ? reset.expiry_time : null,
    sendAfter: entry.send_after,
    deleteAfter: entry.delete_after,
    sentAt: entry.sent_at,
    mailDestination: entry.mail_destination,
  };
}
