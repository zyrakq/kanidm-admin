import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '@/services/auth.service';
import { notificationService } from '@/services/notification.service';
import type { User } from '@/types/auth.types';
import '@/components/app-header';
import '@/components/footer-info';

@customElement('dashboard-page')
export class DashboardPage extends LitElement {
  @state()
  private user: User | null = null;

  @state()
  private loading = false;

  async connectedCallback() {
    super.connectedCallback();
    await this.loadUserData();
  }

  private async loadUserData() {
    console.log('[Dashboard] Loading user data...');
    const authState = authService.getAuthState();
    this.user = authState.user;
    console.log('[Dashboard] User loaded:', this.user);
  }

  private async handleSignOut() {
    try {
      this.loading = true;
      console.log('[Dashboard] Sign out initiated');
      await authService.signOut();
      console.log('[Dashboard] Sign out successful, redirecting to home...');
      notificationService.success('You have been signed out successfully');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (error) {
      console.error('[Dashboard] Sign out error:', error);
      notificationService.error('Failed to sign out. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  private handleTestSuccess() {
    notificationService.success('Operation completed successfully!');
  }

  private handleTestError() {
    notificationService.error('An error occurred during the operation');
  }

  private handleTestWarning() {
    notificationService.warning('This action requires your attention');
  }

  private handleTestInfo() {
    notificationService.info('New information is available');
  }

  private handleTestLongSuccess() {
    notificationService.success(
      'The operation has been completed successfully! All user data has been synchronized with the remote server, and the local cache has been updated accordingly. Please verify the changes in your dashboard.'
    );
  }

  private handleTestLongError() {
    notificationService.error(
      'Failed to connect to the authentication server. The connection was refused due to network timeout (error code: ETIMEDOUT). Please check your internet connection and try again. If the problem persists, contact your system administrator for assistance.'
    );
  }

  private handleTestLongWarning() {
    notificationService.warning(
      'Your session is about to expire in 5 minutes. Any unsaved changes will be lost. Please save your work and refresh your session to continue working without interruption. This is an automated security measure to protect your account.'
    );
  }

  private handleTestVeryLongInfo() {
    notificationService.info(
      'System maintenance is scheduled for tonight between 2:00 AM and 4:00 AM UTC. During this time, the following services will be temporarily unavailable: user authentication, data synchronization, file uploads, and API access. We apologize for any inconvenience this may cause. All services are expected to be fully operational by 4:30 AM UTC. For emergency support during the maintenance window, please contact our 24/7 helpdesk at support@example.com or call +1-800-123-4567. Thank you for your patience and understanding.'
    );
  }

  render() {
    return html`
      <div class="page">
        <app-header></app-header>
        <main class="main-content">
          <div class="dashboard-container">
            <div class="dashboard-card">
              <h1 class="title">Dashboard</h1>
              <p class="subtitle">Welcome to your protected area</p>

              ${this.user
                ? html`
                    <div class="user-section">
                      <h2>User Information</h2>
                      <div class="user-details">
                        <div class="detail-row">
                          <span class="label">ID:</span>
                          <span class="value">${this.user.id}</span>
                        </div>
                        ${this.user.email
                          ? html`
                              <div class="detail-row">
                                <span class="label">Email:</span>
                                <span class="value">${this.user.email}</span>
                              </div>
                            `
                          : ''}
                        ${this.user.username
                          ? html`
                              <div class="detail-row">
                                <span class="label">Username:</span>
                                <span class="value">${this.user.username}</span>
                              </div>
                            `
                          : ''}
                        ${this.user.displayName
                          ? html`
                              <div class="detail-row">
                                <span class="label">Display Name:</span>
                                <span class="value"
                                  >${this.user.displayName}</span
                                >
                              </div>
                            `
                          : ''}
                      </div>
                    </div>
                  `
                : html`
                    <div class="loading-message">
                      <p>Loading user information...</p>
                    </div>
                  `}

              <div class="test-section">
                <h2>Test Notifications</h2>
                <p class="test-description">
                  Click buttons below to test different notification types
                </p>
                <div class="test-buttons">
                  <button
                    class="btn btn-success"
                    @click=${this.handleTestSuccess}
                  >
                    Success
                  </button>
                  <button class="btn btn-error" @click=${this.handleTestError}>
                    Error
                  </button>
                  <button
                    class="btn btn-warning"
                    @click=${this.handleTestWarning}
                  >
                    Warning
                  </button>
                  <button class="btn btn-info" @click=${this.handleTestInfo}>
                    Info
                  </button>
                </div>
              </div>

              <div class="test-section">
                <h2>Test Long Notifications</h2>
                <p class="test-description">
                  Click to test notifications with long messages (clickable to
                  see full text)
                </p>
                <div class="test-buttons">
                  <button
                    class="btn btn-success"
                    @click=${this.handleTestLongSuccess}
                  >
                    Long Success
                  </button>
                  <button
                    class="btn btn-error"
                    @click=${this.handleTestLongError}
                  >
                    Long Error
                  </button>
                  <button
                    class="btn btn-warning"
                    @click=${this.handleTestLongWarning}
                  >
                    Long Warning
                  </button>
                  <button
                    class="btn btn-info"
                    @click=${this.handleTestVeryLongInfo}
                  >
                    Very Long Info
                  </button>
                </div>
              </div>

              <div class="actions">
                <button
                  class="btn btn-danger"
                  @click=${this.handleSignOut}
                  ?disabled=${this.loading}
                >
                  ${this.loading ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        </main>
        <footer-info></footer-info>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }

    .page {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: #f9fafb;
    }

    .main-content {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2rem 1rem;
    }

    .dashboard-container {
      width: 100%;
      max-width: 600px;
    }

    .dashboard-card {
      background: white;
      border-radius: 8px;
      padding: 3rem 2.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }

    .title {
      font-size: 2rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 0.5rem 0;
    }

    .subtitle {
      font-size: 1rem;
      color: #6b7280;
      margin: 0 0 2rem 0;
    }

    .user-section {
      margin: 2rem 0;
    }

    .user-section h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 1rem 0;
    }

    .user-details {
      background: #f9fafb;
      border-radius: 6px;
      padding: 1.5rem;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 600;
      color: #4b5563;
    }

    .value {
      color: #1f2937;
      word-break: break-all;
    }

    .loading-message {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }

    .actions {
      margin-top: 2rem;
      display: flex;
      justify-content: center;
    }

    .btn {
      padding: 0.75rem 2rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      font-family: inherit;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #dc2626;
    }

    .btn-danger:active:not(:disabled) {
      background: #b91c1c;
    }

    .test-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: #f9fafb;
      border-radius: 6px;
    }

    .test-section h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 0.5rem 0;
    }

    .test-description {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0 0 1rem 0;
    }

    .test-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .btn-success {
      background: #10b981;
      color: white;
    }

    .btn-success:hover {
      background: #059669;
    }

    .btn-success:active {
      background: #047857;
    }

    .btn-error {
      background: #ef4444;
      color: white;
    }

    .btn-error:hover {
      background: #dc2626;
    }

    .btn-error:active {
      background: #b91c1c;
    }

    .btn-warning {
      background: #f59e0b;
      color: white;
    }

    .btn-warning:hover {
      background: #d97706;
    }

    .btn-warning:active {
      background: #b45309;
    }

    .btn-info {
      background: #3b82f6;
      color: white;
    }

    .btn-info:hover {
      background: #2563eb;
    }

    .btn-info:active {
      background: #1d4ed8;
    }

    @media (max-width: 640px) {
      .main-content {
        padding: 1.5rem 1rem;
      }

      .dashboard-card {
        padding: 2rem 1.5rem;
      }

      .title {
        font-size: 1.75rem;
      }

      .detail-row {
        flex-direction: column;
        gap: 0.25rem;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-page': DashboardPage;
  }
}
