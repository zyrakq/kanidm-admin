import { css } from 'lit';

export const messagesPageStyles = css`
  :host {
    display: block;
  }
  .page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .tabs {
    margin-bottom: 16px;
  }
  .send-test-card {
    margin-bottom: 16px;
  }
  .send-test-row {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }
  .send-test-row form-field {
    flex: 1;
    min-width: 220px;
    /* Kill the field's error-space margin so the button bottom
       aligns with the input bottom edge. */
    --field-margin: 0;
  }
  .mono {
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
  }
  .detail-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 16px;
    font-size: 14px;
  }
  .detail-grid dt {
    margin: 0;
    font-weight: 600;
    color: var(--theme-color-text-secondary);
  }
  .detail-grid dd {
    margin: 0;
    color: var(--theme-color-text-primary);
    word-break: break-word;
  }
`;
