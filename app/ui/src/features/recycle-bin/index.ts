// Recycle bin feature public surface.
export { recycleBinService } from './services/recycle-bin.service.ts';
export type { RecycleBinEntry } from './types/recycle-bin.types.ts';
export { toRecycleBinEntry } from './types/recycle-bin.types.ts';

// Side-effect import: registering the custom element when the feature
// is imported.
import './components/recycle-bin-page.ts';
