// Groups feature public surface.
export { groupService } from './services/group.service.ts';
export type {
  GroupSummary,
  GroupDetail,
} from './types/group.types.ts';
export { ACCOUNT_POLICY_ATTRS } from './types/group.types.ts';
export {
  toGroupSummary,
  toGroupDetail,
} from './types/group.types.ts';

// Side-effect imports: registering the custom elements when the feature
// is imported.
import './components/group-list-page.ts';
import './components/group-detail-page.ts';
