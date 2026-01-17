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
async function requireAuth(context: any, commands: any): Promise<any> {
  console.log('[Router] Checking authentication for:', context.pathname);

  // Initialize auth service if not already done
  await authService.init();

  const isAuthenticated = authService.isAuthenticated();

  if (!isAuthenticated) {
    console.log('[Router] User not authenticated, redirecting to home');
    return commands.redirect('/');
  }

  console.log('[Router] User authenticated, allowing access');
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
        console.log('[Router] Navigating to home page');
        // Initialize auth service on home page
        await authService.init();
      },
    },
    {
      path: '/auth/callback',
      component: 'oauth-callback',
      action: () => {
        console.log('[Router] Navigating to OAuth callback page');
      },
    },
    {
      path: '/dashboard',
      component: 'dashboard-page',
      action: requireAuth,
    },
    {
      path: '(.*)',
      redirect: '/',
      action: () => {
        console.log('[Router] Route not found, redirecting to home');
      },
    },
  ]);

  console.log('[Router] Router initialized');
  return router;
}
