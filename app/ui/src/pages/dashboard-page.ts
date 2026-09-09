import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { dashboardPageStyles } from './dashboard-page.styles';
import type { User } from '@/features/auth';
import '@/shared/components/app-header';
import '@/shared/components/footer-info';

@customElement('dashboard-page')
@localized()
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
      notificationService.error(msg('Failed to sign out. Please try again.'));
    } finally {
      this.loading = false;
    }
  }

  private handleTestSuccess() {
    notificationService.success(msg('Operation completed successfully!'));
  }

  private handleTestError() {
    notificationService.error(msg('An error occurred during the operation'));
  }

  private handleTestWarning() {
    notificationService.warning(msg('This action requires your attention'));
  }

  private handleTestInfo() {
    notificationService.info(msg('New information is available'));
  }

  private handleTestLongSuccess() {
    notificationService.success(
      msg(
        'The operation has been completed successfully! All user data has been synchronized with the remote server, and the local cache has been updated accordingly. Please verify the changes in your dashboard.'
      )
    );
  }

  private handleTestLongError() {
    notificationService.error(
      msg(
        'Failed to connect to the authentication server. The connection was refused due to network timeout (error code: ETIMEDOUT). Please check your internet connection and try again. If the problem persists, contact your system administrator for assistance.'
      )
    );
  }

  private handleTestVeryLongInfo() {
    notificationService.info(
      msg(
        'System maintenance is scheduled for tonight between 2:00 AM and 4:00 AM UTC. During this time, the following services will be temporarily unavailable: user authentication, data synchronization, file uploads, and API access. We apologize for any inconvenience this may cause. All services are expected to be fully operational by 4:30 AM UTC. For emergency support during the maintenance window, please contact our 24/7 helpdesk at support@example.com or call +1-800-123-4567. Thank you for your patience and understanding.'
      )
    );
  }

  render() {
    return html`
      <div class="page">
        <app-header></app-header>
        <main class="main-content">
          <div class="dashboard-container">
            <div class="dashboard-card">
              <h1 class="title">${msg('Dashboard')}</h1>
              <p class="subtitle">${msg('Welcome to your protected area')}</p>

              ${this.user
                ? html`
                    <div class="user-section">
                      <h2>${msg('User Information')}</h2>
                      <div class="user-details">
                        <div class="detail-row">
                          <span class="label">${msg('ID')}:</span>
                          <span class="value">${this.user.id}</span>
                        </div>
                        ${this.user.email
                          ? html`
                              <div class="detail-row">
                                <span class="label">${msg('Email')}:</span>
                                <span class="value">${this.user.email}</span>
                              </div>
                            `
                          : ''}
                        ${this.user.username
                          ? html`
                              <div class="detail-row">
                                <span class="label">${msg('Username')}:</span>
                                <span class="value">${this.user.username}</span>
                              </div>
                            `
                          : ''}
                        ${this.user.displayName
                          ? html`
                              <div class="detail-row">
                                <span class="label"
                                  >${msg('Display Name')}:</span
                                >
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
                      <p>${msg('Loading user information...')}</p>
                    </div>
                  `}

              <div class="test-section">
                <h2>${msg('Test Notifications')}</h2>
                <p class="test-description">
                  ${msg(
                    'Click buttons below to test different notification types'
                  )}
                </p>
                <div class="test-buttons">
                  <button
                    class="btn btn-success"
                    @click=${this.handleTestSuccess}
                  >
                    ${msg('Success')}
                  </button>
                  <button class="btn btn-error" @click=${this.handleTestError}>
                    ${msg('Error')}
                  </button>
                  <button
                    class="btn btn-warning"
                    @click=${this.handleTestWarning}
                  >
                    ${msg('Warning')}
                  </button>
                  <button class="btn btn-info" @click=${this.handleTestInfo}>
                    ${msg('Info')}
                  </button>
                </div>
              </div>

              <div class="test-section">
                <h2>${msg('Test Long Notifications')}</h2>
                <p class="test-description">
                  ${msg(
                    'Click to test notifications with long messages (clickable to see full text)'
                  )}
                </p>
                <div class="test-buttons">
                  <button
                    class="btn btn-success"
                    @click=${this.handleTestLongSuccess}
                  >
                    ${msg('Long Success')}
                  </button>
                  <button
                    class="btn btn-error"
                    @click=${this.handleTestLongError}
                  >
                    ${msg('Long Error')}
                  </button>
                  <button
                    class="btn btn-info"
                    @click=${this.handleTestVeryLongInfo}
                  >
                    ${msg('Very Long Info')}
                  </button>
                </div>
              </div>

              <div class="actions">
                <button
                  class="btn btn-danger"
                  @click=${this.handleSignOut}
                  ?disabled=${this.loading}
                >
                  ${this.loading ? msg('Signing out...') : msg('Sign Out')}
                </button>
              </div>
            </div>
          </div>
        </main>
        <footer-info></footer-info>
      </div>
    `;
  }

  static styles = dashboardPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-page': DashboardPage;
  }
}
