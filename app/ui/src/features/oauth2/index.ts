// OAuth2 feature public surface.
export { oauth2Service, type Oauth2ClaimMapJoin, type Oauth2UpdateChanges } from './services/oauth2.service.ts';
export type {
  Oauth2RsSummary,
  Oauth2RsDetail,
  ScopeMap,
  ClaimMap,
} from './types/oauth2.types.ts';

// Side-effect imports: registering the custom elements when the feature
// is imported.
import './components/oauth2-list-page.ts';
import './components/oauth2-detail-page.ts';
