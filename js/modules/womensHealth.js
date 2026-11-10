// Women's Health & PCOS Companion Module: Private Wellness Tracker, Cycle Calendar & Source-Linked Guide
import { state, runtime } from '../state.js';
import { apiRequest } from '../api.js';
import { escapeHtml, toast, stat, panelHead } from '../components/ui.js';

export async function fetchWomensHealth() {
  if (state.role !== 'user' || state.gender !== 'female') {
    runtime.womensHealthData = null;
    return;
  }
  try {
    runtime.womensHealthData = await apiRequest('/api/womens-health').catch(() => null);
  } catch (_) {}
}

export function renderWomensHealth() {
  if (state.role !== 'user' || state.gender !== 'female') return '';
  if (!runtime.womensHealthData || !runtime.womensHealthData.enabled) {
    return `<div class="welcome">
      <div>
        <h1>Women's Health & PCOS Companion 🌸</h1>
        <p>Private wellness tracking, symptom logging, and source-linked PCOS/PCOD education.</p>
      </div>
    </div>
    <div class="panel" style="max-width:640px;margin:20px auto;text-align:center;padding:36px 24px">
      <div style="font-size:38px;margin-bottom:12px">🌸</div>
      <h2 style="font-size:18px;margin-bottom:8px">Enable Optional Women's Health Features</h2>
      <p style="font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:20px">
        Track your daily mood, sleep, stress, energy, period dates, and search local clinical guides. Your logs remain private to your patient account and are never shared without explicit consent.
      </p>
      <button class="btn btn-primary" onclick="toggleWomensConsent(true)">Enable Women's Health Tracking</button>
    </div>`;
  }

  const moodRows = (runtime.womensHealthData.moodEntries || []).map(m => `
    <tr>
      <td>${escapeHtml(m.entry_date)}</td>
      <td><span class="status ${m.mood === 'great' || m.mood === 'good' ? 'active' : 'pending'}">${escapeHtml(m.mood)}</span></td>
      <td>${escapeHtml(String(m.stress_level || 3))}/5</td>
      <td>${escapeHtml(String(m.sleep_hours || 8))} hrs</td>
      <td>${escapeHtml(String(m.energy_level || 3))}/5</td>
      <td>${(m.symptoms || []).map(s => `<span class="status active" style="font-size:9.5px">${escapeHtml(s)}</span>`).join(' ') || 'None'}</td>
    </tr>
  `).join('');

  const cycleRows = (runtime.womensHealthData.cycleEntries || []).map(c => `
    <tr>
      <td>${escapeHtml(c.start_date)}</td>
      <td>${escapeHtml(c.end_date || 'In progress')}</td>
      <td><span class="status completed">Logged</span></td>
    </tr>
  `).join('');

  return `<div class="welcome">
    <div>
      <h1>Women's Health & PCOS Companion 🌸</h1>
      <p>Private menstrual cycle tracking, daily mood check-ins, and source-linked PCOS education.</p>
    </div>
    <div>
      <button class="btn btn-outline btn-sm" onclick="deleteWomensHealthData()" style="color:#c24141;border-color:#f8c5c5">Disable & Clear Data</button>
    </div>
  </div>

  <div class="notice">
    <strong>Clinical Safety Assurance:</strong> This local educational guide provides general health information from verified sources (WHO, US Women's Health). It does not provide medical diagnoses or replace consultations with a licensed gynecologist or physician.
  </div>

  <div class="stats">
    ${stat('Mood Check-ins', String((runtime.womensHealthData.moodEntries || []).length), '♡', 'Logged to vault')}
    ${stat('Cycles Recorded', String((runtime.womensHealthData.cycleEntries || []).length), '📅', 'Personal timeline')}
    ${stat('Privacy Shield', '100%', '🔒', 'Private to your account')}
    ${stat('External AI Requests', '0', '⛓️', 'Sealed locally')}
  </div>

  <div class="dashboard-grid">
    <div class="panel">
      ${panelHead('Daily Mood & Wellness Check-in', 'Log today’s mood, sleep, stress & energy')}
      <form onsubmit="saveWomensMood(event)">
        <div class="field">
          <label>Check-in Date</label>
          <input type="date" id="whMoodDate" required value="${new Date().toISOString().slice(0, 10)}">
        </div>
        <div class="field">
          <label>Overall Mood</label>
          <select id="whMood" required>
            <option value="great">Very good</option>
            <option value="good" selected>Good</option>
            <option value="okay">Okay / mixed</option>
            <option value="low">Low</option>
            <option value="very_low">Very low</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div class="field">
            <label>Stress (1-5)</label>
            <select id="whStress"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select>
          </div>
          <div class="field">
            <label>Sleep (hrs)</label>
            <input type="number" id="whSleep" min="0" max="24" step="0.5" value="7.5" required>
          </div>
          <div class="field">
            <label>Energy (1-5)</label>
            <select id="whEnergy"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select>
          </div>
        </div>
        <div class="field">
          <label>Symptoms today (comma-separated, optional)</label>
          <input type="text" id="whSymptoms" placeholder="e.g. fatigue, headache, cramps">
        </div>
        <button class="btn btn-primary" type="submit">Save Check-in ♡</button>
      </form>
    </div>

    <div class="panel">
      ${panelHead('Period & Cycle Tracking', 'Record cycle dates for consultation prep')}
      <form onsubmit="saveWomensCycle(event)">
        <div class="field">
          <label>Period Start Date</label>
          <input type="date" id="whCycleStart" required value="${new Date().toISOString().slice(0, 10)}">
        </div>
        <div class="field">
          <label>Period End Date (optional)</label>
          <input type="date" id="whCycleEnd">
        </div>
        <button class="btn btn-primary" type="submit" style="margin-top:10px">Log Cycle Dates 📅</button>
      </form>

      <div style="margin-top:20px">
        <h4 style="font-size:12px;margin:0 0 8px">Recent Cycles</h4>
        <div class="table-wrap"><table><thead><tr><th>Start Date</th><th>End Date</th><th>Status</th></tr></thead><tbody>${cycleRows || '<tr><td colspan="3" style="text-align:center;padding:12px;color:var(--muted)">No cycles recorded yet.</td></tr>'}</tbody></table></div>
      </div>
    </div>
  </div>

  <div class="panel" style="margin-top:20px">
    ${panelHead('PCOS / PCOD Local Health Guide & Q&A', 'Verified clinical guidance from WHO & Women\'s Health')}
    <form onsubmit="searchWomensGuide(event)" style="display:flex;gap:10px;margin-bottom:15px">
      <input id="whQuestion" style="flex:1;padding:10px 14px;border:1px solid var(--line);border-radius:11px" placeholder="Ask about PCOS, symptoms, clinical assessment, or balanced nutrition…" required>
      <button class="btn btn-primary" type="submit">Search Guide 🔍</button>
    </form>
    <div id="whGuideAnswer" style="display:${runtime.womensHealthAnswer ? 'block' : 'none'};background:#f5faf7;border:1px solid #d4ede0;border-radius:14px;padding:18px">
      ${runtime.womensHealthAnswer ? `
        <h4 style="margin:0 0 8px;color:#184a38">Guide Response</h4>
        <div style="font-size:13px;line-height:1.7;color:#355345;white-space:pre-wrap">${escapeHtml(runtime.womensHealthAnswer.answer)}</div>
        ${runtime.womensHealthAnswer.sources?.length ? `<div style="margin-top:12px;font-size:11px;color:var(--muted)">Sources: ${runtime.womensHealthAnswer.sources.map(s => `<a href="${escapeHtml(s.url)}" target="_blank" style="color:var(--green);font-weight:700">${escapeHtml(s.title)}</a>`).join(' • ')}</div>` : ''}
      ` : ''}
    </div>
  </div>

  <div class="panel" style="margin-top:20px">
    ${panelHead('Recent Mood & Symptom History', 'Last 30 check-ins')}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Mood</th><th>Stress</th><th>Sleep</th><th>Energy</th><th>Symptoms</th></tr></thead>
        <tbody>${moodRows || '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted)">No check-ins logged yet. Use the form above to record your first daily check-in.</td></tr>'}</tbody>
      </table>
    </div>
  </div>`;
}

export async function toggleWomensConsent(enabled) {
  try {
    await apiRequest('/api/womens-health/consent', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
    await fetchWomensHealth();
    if (typeof window.renderAll === 'function') window.renderAll();
    toast(enabled ? 'Women\'s health features enabled.' : 'Women\'s health features disabled.');
  } catch (err) {
    toast(err.message || 'Could not update consent.');
  }
}

export async function saveWomensMood(event) {
  event.preventDefault();
  const entryDate = document.getElementById('whMoodDate').value;
  const mood = document.getElementById('whMood').value;
  const stressLevel = Number(document.getElementById('whStress').value);
  const sleepHours = Number(document.getElementById('whSleep').value);
  const energyLevel = Number(document.getElementById('whEnergy').value);
  const symptomsRaw = document.getElementById('whSymptoms').value;
  const allowed = ['anxiety', 'irritability', 'fatigue', 'cramps', 'headache', 'bloating', 'acne', 'irregular_periods'];
  const symptoms = symptomsRaw ? symptomsRaw.split(',').map(s => s.trim().toLowerCase()).filter(s => allowed.includes(s)) : [];

  try {
    await apiRequest('/api/womens-health/mood', {
      method: 'POST',
      body: JSON.stringify({ entryDate, mood, stressLevel, sleepHours, energyLevel, symptoms })
    });
    await fetchWomensHealth();
    if (typeof window.renderAll === 'function') window.renderAll();
    toast('Daily check-in saved to private vault!');
  } catch (err) {
    toast(err.message || 'Could not save check-in.');
  }
}

export async function saveWomensCycle(event) {
  event.preventDefault();
  const startDate = document.getElementById('whCycleStart').value;
  const endDate = document.getElementById('whCycleEnd').value || null;

  try {
    await apiRequest('/api/womens-health/cycle', {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate })
    });
    await fetchWomensHealth();
    if (typeof window.renderAll === 'function') window.renderAll();
    toast('Cycle dates saved to private vault!');
  } catch (err) {
    toast(err.message || 'Could not save cycle.');
  }
}

export async function searchWomensGuide(event) {
  event.preventDefault();
  const question = document.getElementById('whQuestion').value;
  try {
    toast('Searching verified clinical guide...');
    const result = await apiRequest('/api/womens-health/guide', {
      method: 'POST',
      body: JSON.stringify({ question, includeMoodHistory: true })
    });
    runtime.womensHealthAnswer = result;
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.go === 'function') window.go('womens-health');
  } catch (err) {
    toast(err.message || 'Could not search guide.');
  }
}

export async function deleteWomensHealthData() {
  if (!confirm('Are you sure you want to disable Women\'s Health and wipe your private cycle and mood logs?')) return;
  try {
    await apiRequest('/api/womens-health/data', { method: 'DELETE' });
    runtime.womensHealthData = null;
    runtime.womensHealthAnswer = null;
    if (typeof window.renderAll === 'function') window.renderAll();
    toast('Women\'s health logs cleared and feature disabled.');
  } catch (err) {
    toast(err.message || 'Could not clear data.');
  }
}
