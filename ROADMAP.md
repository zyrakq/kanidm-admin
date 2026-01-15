# Kanidm Admin - Roadmap

This document outlines the planned features and improvements for the Kanidm Admin project.

## Phase 1: Authentication & Landing Page ✅

**Status: In Progress**

- [x] Welcome page with modern design (Authentik-inspired)
- [x] Authentication status display
- [x] Feature showcase
- [ ] OIDC integration
  - [ ] Configure OIDC provider connection
  - [ ] Implement authorization flow
  - [ ] Handle callback and token storage
  - [ ] Implement token refresh
- [ ] Basic routing/navigation
  - [ ] Route guards for protected pages
  - [ ] Navigation between pages

---

## Phase 2: Core Admin Features

**Status: Planned**

### User Management

- [ ] User list view with search and filtering
- [ ] User details page
- [ ] Create new user
- [ ] Edit user information
- [ ] Delete user
- [ ] User groups assignment
- [ ] User credentials management

### Group Management

- [ ] Group list view
- [ ] Group details page
- [ ] Create new group
- [ ] Edit group information
- [ ] Delete group
- [ ] Group members management
- [ ] Nested groups support

### OAuth2/OIDC Configuration

- [ ] OAuth2 clients list
- [ ] Create/edit OAuth2 client
- [ ] Client credentials management
- [ ] Redirect URIs configuration
- [ ] Scopes management
- [ ] Token settings

### System Settings

- [ ] General settings page
- [ ] Security settings
- [ ] Email/notification settings
- [ ] Backup and restore

---

## Phase 3: Advanced Features

**Status: Planned**

### Audit Logs

- [ ] Activity log viewer
- [ ] Filter logs by:
  - [ ] User
  - [ ] Action type
  - [ ] Date range
  - [ ] Resource type
- [ ] Export logs (CSV, JSON)
- [ ] Log retention policies
- [ ] Real-time log streaming

### Admin Activity Tracking

- [ ] Track all admin actions
- [ ] Admin session management
- [ ] Failed login attempts monitoring
- [ ] Suspicious activity alerts

### Search and Filtering

- [ ] Global search across users, groups, clients
- [ ] Advanced filtering options
- [ ] Saved filters/views
- [ ] Bulk operations

---

## Phase 4: UX Improvements

**Status: Planned**

### Internationalization (i18n)

- [ ] Set up i18n framework
- [ ] English language (default)
- [ ] Russian language
- [ ] Language switcher component
- [ ] Date/time formatting per locale
- [ ] RTL support (if needed)

### Theme Support

- [ ] Light theme (default)
- [ ] Dark theme
- [ ] Theme switcher
- [ ] Custom color schemes
- [ ] Persistent theme preference

### UI Customization

- [ ] Customizable logo/branding
- [ ] Custom color palette
- [ ] Custom welcome message
- [ ] White-labeling support

### Accessibility

- [ ] ARIA labels and roles
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] High contrast mode
- [ ] WCAG 2.1 AA compliance

---

## Phase 5: Enterprise Features

**Status: Future**

### Multi-tenancy

- [ ] Tenant isolation
- [ ] Per-tenant configuration
- [ ] Tenant management UI
- [ ] Cross-tenant reporting

### Advanced RBAC

- [ ] Custom roles and permissions
- [ ] Fine-grained access control
- [ ] Permission inheritance
- [ ] Role templates

### SSO Federation

- [ ] Multiple OIDC providers
- [ ] SAML support
- [ ] Social login providers
- [ ] Account linking

### Monitoring & Analytics

- [ ] Dashboard with metrics
- [ ] Login analytics
- [ ] User activity charts
- [ ] Performance monitoring
- [ ] Health checks

---

## Technical Debt & Improvements

### Code Quality

- [ ] Add comprehensive unit tests
- [ ] Add integration tests
- [ ] Add E2E tests
- [ ] Improve type safety
- [ ] Add JSDoc comments

### Performance

- [ ] Implement virtual scrolling for large lists
- [ ] Optimize bundle size
- [ ] Implement code splitting
- [ ] Add caching strategies
- [ ] Lazy load components

### DevOps

- [ ] CI/CD pipeline
- [ ] Automated testing
- [ ] Docker support
- [ ] Kubernetes deployment
- [ ] Production build optimization

### Documentation

- [ ] User guide
- [ ] API documentation
- [ ] Development guide
- [ ] Deployment guide
- [ ] Architecture documentation

---

## Contributing

We welcome contributions! If you'd like to work on any of these features, please:

1. Check if there's an existing issue
2. Create an issue to discuss the implementation
3. Submit a pull request

---

**Last Updated:** January 15, 2026
