import { Router } from '@vaadin/router';
import { authService } from './services/auth.service';

// Import components (they will be registered as custom elements)
import './components/welcome-page';
import './components/oauth-callback';
import './components/dashboard-page';
import './components/toast-container';

/**
 * Guard function to protect routes that require authentication
 */
async function requireAuth(_context: any, commands: any): Promise<any> {
  // Initialize auth service if not already done
  await authService.init();

  const isAuthenticated = authService.isAuthenticated();

  if (!isAuthenticated) {
    return commands.redirect('/');
  }

  return undefined;
}

/**
 * Initialize and configure the router
 */
export function initRouter(outlet: HTMLElement): Router {
  const router = new Router(outlet);

  router.setRoutes([
    {
      path: '/',
      component: 'welcome-page',
      action: async () => {
        // Initialize auth service on home page
        await authService.init();
      },
    },
    {
      path: '/auth/callback',
      component: 'oauth-callback',
    },
    {
      path: '/dashboard',
      component: 'dashboard-page',
      action: requireAuth,
    },
    {
      path: '(.*)',
      redirect: '/',
    },
  ]);

  return router;
}
