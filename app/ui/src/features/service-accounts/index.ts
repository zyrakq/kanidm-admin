// Service accounts feature public surface.
export { serviceAccountService } from './services/service-account.service.ts';
export type {
  ServiceAccountSummary,
  ServiceAccountDetail,
  ApiTokenPurpose,
  ApiTokenView,
  CredentialDetailType,
  CredentialStatusView,
  UatStatusState,
  UatPurposeStatus,
  SessionItem,
  UnixUserTokenView,
} from './types/service-account.types.ts';
export {
  toServiceAccountSummary,
  toServiceAccountDetail,
} from './types/service-account.types.ts';

// Side-effect imports: registering the custom elements when the feature
// is imported.
import './components/service-account-list-page.ts';
import './components/service-account-detail-page.ts';
