// Billing & Invoices Module: Hospital Statements & Payment Ledgers
import { stat, panelHead, toast } from '../components/ui.js';

export function renderBilling() {
  return `<div class="welcome">
    <div>
      <h1>Bills & payments</h1>
      <p>Review charges and keep track of your billing status.</p>
    </div>
    <button class="btn btn-outline" onclick="toast('No billing statements generated yet.')">⬇ Statement</button>
  </div>
  <div class="stats">
    ${stat('Total outstanding', '₹0', '💳', 'Current balance')}
    ${stat('Last payment', '₹0', '🧾', 'No recent payments')}
    ${stat('Invoices', '0', '📄', 'Across recent visits')}
    ${stat('Payment status', 'Settled', '📅', 'All accounts up to date')}
  </div>
  <div class="panel">
    ${panelHead('Recent invoices', 'Hospital billing statements')}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Description</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="6" style="text-align:center;padding:28px;color:var(--muted)">
              No pending invoices. Consultation charges and invoices will appear here after your visits.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

