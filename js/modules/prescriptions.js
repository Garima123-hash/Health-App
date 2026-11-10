// Prescriptions Module: Active Clinical Medications & Refills
import { panelHead, toast } from '../components/ui.js';

export function renderPrescriptions() {
  return `<div class="welcome">
    <div>
      <h1>Prescriptions</h1>
      <p>Review your medication list and refill reminders.</p>
    </div>
    <button class="btn btn-outline" onclick="toast('No active prescriptions to download.')">⬇ Download list</button>
  </div>
  <div class="notice">Always follow the directions provided by your licensed clinician. This screen contains your active medication records.</div>
  <div class="panel">
    ${panelHead('Current prescriptions', 'Active clinical prescriptions')}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Medication</th>
            <th>Prescribed by</th>
            <th>Instructions</th>
            <th>Refills</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="5" style="text-align:center;padding:28px;color:var(--muted)">
              No active prescriptions recorded for your profile. Prescriptions from doctor consultations will appear here.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`;
}
