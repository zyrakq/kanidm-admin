// Message service — every call goes through the backend proxy
// (/api/kanidm/*). Endpoints mirror the vendored kanidm client
// (libs/client/src/message.rs); writes are wrapped in withStepUp by the
// calling components. Quirk: sendTest is a GET, not a POST (vendor
// idm_message_send_test uses perform_get_request).

import { apiFetch } from '@/shared/services/http-client';
import type {
  MessageDetail,
  MessageSummary,
  ScimListMessageWire,
  ScimEntryMessageWire,
} from '../types/message.types';
import { toMessageDetail, toMessageSummary } from '../types/message.types';

const BASE = '/api/kanidm/scim/v1';

class MessageService {
  private static instance: MessageService;

  private constructor() {}

  static getInstance(): MessageService {
    if (!MessageService.instance) {
      MessageService.instance = new MessageService();
    }
    return MessageService.instance;
  }

  /** List all messages (GET /scim/v1/Message, vendor idm_message_list). */
  async list(): Promise<MessageSummary[]> {
    const envelope = await apiFetch<ScimListMessageWire>(`${BASE}/Message`);
    return envelope.resources.map(toMessageSummary);
  }

  /** List messages ready to send (GET /scim/v1/Message/_ready, vendor idm_message_list_ready). */
  async listReady(): Promise<MessageSummary[]> {
    const envelope = await apiFetch<ScimListMessageWire>(
      `${BASE}/Message/_ready`
    );
    return envelope.resources.map(toMessageSummary);
  }

  /** Get one message by uuid (GET /scim/v1/Message/{uuid}, vendor idm_message_get). */
  async get(uuid: string): Promise<MessageDetail> {
    const entry = await apiFetch<ScimEntryMessageWire>(
      `${BASE}/Message/${encodeURIComponent(uuid)}`
    );
    return toMessageDetail(entry);
  }

  /** Mark a message as sent (POST /scim/v1/Message/{uuid}/_sent, vendor idm_message_mark_sent, empty body). */
  async markSent(uuid: string): Promise<void> {
    await apiFetch<void>(`${BASE}/Message/${encodeURIComponent(uuid)}/_sent`, {
      method: 'POST',
      body: 'null',
    });
  }

  /**
   * Queue a test message for a person (vendor idm_message_send_test).
   * NOTE: GET, not POST — quirk of the vendored API.
   */
  async sendTest(personId: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/Person/${encodeURIComponent(personId)}/_message/_send_test`
    );
  }
}

export const messageService = MessageService.getInstance();
