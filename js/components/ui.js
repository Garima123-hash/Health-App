// Reusable UI Components & Helpers

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

export function stat(title, value, icon, foot) {
  return `<article class="stat-card"><div class="stat-head"><span>${escapeHtml(title)}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${escapeHtml(value)}</div><div class="stat-foot">${foot}</div></article>`;
}

export function panelHead(title, sub = '', action = '') {
  return `<div class="panel-head"><div><h2>${escapeHtml(title)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ''}</div>${action}</div>`;
}

export function quick(icon, title, desc, action) {
  return `<button class="quick-action" onclick="${action}"><div class="qa-icon">${icon}</div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(desc)}</span></button>`;
}

export function chart() {
  const heights = [44, 61, 52, 76, 63, 88, 70];
  return `<div class="chart">${heights.map((h, i) =>
    `<div class="bar-col"><div class="bar-pair"><div class="bar" style="height:${Math.max(15, h - 22)}%"></div><div class="bar dark" style="height:${h}%"></div></div><div class="bar-label">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</div></div>`
  ).join('')}</div>
  <div style="display:flex;gap:16px;margin-top:14px;font-size:10px;color:var(--muted)">
    <span><span style="display:inline-block;width:8px;height:8px;background:#bde7d2;border-radius:2px;margin-right:5px"></span>Previous week</span>
    <span><span style="display:inline-block;width:8px;height:8px;background:var(--green);border-radius:2px;margin-right:5px"></span>This week</span>
  </div>`;
}

export function toLocalDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

