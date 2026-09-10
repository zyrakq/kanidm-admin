// System feature public surface.
export { systemService } from './services/system.service.ts';

// Side-effect import: registering the custom element when the feature
// is imported.
import './components/system-page.ts';
