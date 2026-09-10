// Sync accounts feature public surface.
export { syncAccountService } from './services/sync-account.service.ts';
export type {
  SyncAccountSummary,
  SyncAccountDetail,
} from './types/sync-account.types.ts';

// Side-effect imports: registering the custom elements when the feature
// is imported.
import './components/sync-list-page.ts';
import './components/sync-detail-page.ts';
