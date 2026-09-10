// Persons feature public surface.
export { personService } from './services/person.service.ts';
export type {
  PersonSummary,
  PersonDetail,
  CredentialDetailType,
  CredentialStatusView,
  UatStatusState,
  UatPurposeStatus,
  SessionItem,
  UnixUserTokenView,
} from './types/person.types.ts';

// Side-effect imports: registering the custom elements when the feature
// is imported.
import './components/person-list-page.ts';
import './components/person-detail-page.ts';
