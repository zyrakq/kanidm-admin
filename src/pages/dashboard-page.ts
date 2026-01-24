import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import type { User } from '@/features/auth';
import '@/shared/components/app-header';
import '@/shared/components/footer-info';

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
    const authState = authService.getAuthState();
    this.user = authState.user;
  }

  private async handleSignOut() {
    try {
      this.loading = true;
      await authService.signOut();
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (error) {
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
      background: var(--theme-color-background);
      transition: background-color 0.2s ease;
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
      background: var(--theme-color-surface);
      border-radius: 8px;
      padding: 3rem 2.5rem;
      box-shadow: var(--theme-shadow-md);
      transition:
        background-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    .title {
      font-size: 2rem;
      font-weight: 700;
      color: var(--theme-color-text-primary);
      margin: 0 0 0.5rem 0;
      transition: color 0.2s ease;
    }

    .subtitle {
      font-size: 1rem;
      color: var(--theme-color-text-secondary);
      margin: 0 0 2rem 0;
      transition: color 0.2s ease;
    }

    .user-section {
      margin: 2rem 0;
    }

    .user-section h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--theme-color-text-primary);
      margin: 0 0 1rem 0;
      transition: color 0.2s ease;
    }

    .user-details {
      background: var(--theme-color-background);
      border-radius: 6px;
      padding: 1.5rem;
      transition: background-color 0.2s ease;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--theme-color-border);
      transition: border-color 0.2s ease;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 600;
      color: var(--theme-color-text-secondary);
      transition: color 0.2s ease;
    }

    .value {
      color: var(--theme-color-text-primary);
      word-break: break-all;
      transition: color 0.2s ease;
    }

    .loading-message {
      text-align: center;
      padding: 2rem;
      color: var(--theme-color-text-secondary);
      transition: color 0.2s ease;
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
      background: var(--theme-color-error);
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
      background: var(--theme-color-background);
      border-radius: 6px;
      transition: background-color 0.2s ease;
    }

    .test-section h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--theme-color-text-primary);
      margin: 0 0 0.5rem 0;
      transition: color 0.2s ease;
    }

    .test-description {
      font-size: 0.875rem;
      color: var(--theme-color-text-secondary);
      margin: 0 0 1rem 0;
      transition: color 0.2s ease;
    }

    .test-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .btn-success {
      background: var(--theme-color-success);
      color: white;
    }

    .btn-success:hover {
      background: #059669;
    }

    .btn-success:active {
      background: #047857;
    }

    .btn-error {
      background: var(--theme-color-error);
      color: white;
    }

    .btn-error:hover {
      background: #dc2626;
    }

    .btn-error:active {
      background: #b91c1c;
    }

    .btn-warning {
      background: var(--theme-color-warning);
      color: white;
    }

    .btn-warning:hover {
      background: #d97706;
    }

    .btn-warning:active {
      background: #b45309;
    }

    .btn-info {
      background: var(--theme-color-info);
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
