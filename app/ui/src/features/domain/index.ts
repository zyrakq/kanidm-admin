// Domain feature public surface.
export { domainService } from './services/domain.service.ts';
export type { DomainInfo } from './types/domain.types.ts';
export { toDomainInfo } from './types/domain.types.ts';

// Side-effect import: registering the custom element when the feature
// is imported.
import './components/domain-page.ts';
