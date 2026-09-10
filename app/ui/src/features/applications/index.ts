// Applications feature public surface.
export { applicationService } from './services/application.service.ts';
export type {
  ApplicationSummary,
  ApplicationDetail,
  ScimEntryApplication,
  ScimEntryApplicationPost,
  ScimListApplication,
  ScimReference,
} from './types/application.types.ts';
export {
  toApplicationSummary,
  toApplicationDetail,
  linkedGroupValues,
} from './types/application.types.ts';

// Side-effect imports: registering the custom elements when the feature
// is imported.
import './components/application-list-page.ts';
