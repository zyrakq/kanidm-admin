// Messages feature public surface.
export { messageService } from './services/message.service.ts';
export type {
  MessageSummary,
  MessageDetail,
  OutboundMessageWire,
  ScimEntryMessageWire,
  ScimListMessageWire,
  ScimMailWire,
} from './types/message.types.ts';
export {
  toMessageSummary,
  toMessageDetail,
  templateType,
  templateDisplayName,
} from './types/message.types.ts';

// Side-effect import: registering the custom element when the feature
// is imported.
import './components/messages-page.ts';
