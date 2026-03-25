// ============================================
// MyPulsePro — Main Application
// ============================================
// SPA router + Dashboard + Biomarkers + Progress + Diet + AI Chat

(function() {
'use strict';

// ─── State ──────────────────────────────────────────────────────
let currentPage = 'dashboard';
let progressChart = null;
let dietChart = null;

// ─── SPA Router ─────────────────────────────────────────────────
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  const pageEl = document.getElementById(`page-${page}`);
  if (navEl) navEl.classList.add('active');
  if (pageEl) pageEl.classList.add('active');

  const titles = {
    dashboard: ['Dashboard', 'Your health at a glance'],
    biomarkers: ['Biomarkers', '60+ health parameters across 12 categories'],
    progress: ['Progress Tracking', 'Track biomarker trends over time'],
    diet: ['Diet Tracker', 'Log meals and compare with recommended plan'],
    activity: ['Activity & Wearables', 'Log exercise and connect health devices'],
    ai: ['Health AI Assistant', 'Ask questions about your health reports'],
  };
  document.getElementById('page-title').textContent = titles[page]?.[0] || page;
  document.getElementById('page-subtitle').textContent = titles[page]?.[1] || '';

  if (page === 'dashboard') loadDashboard();
  if (page === 'biomarkers') loadBiomarkers();
  if (page === 'progress') loadProgress();
  if (page === 'diet') loadDiet();
  if (page === 'activity') loadActivity();
}

// ─── API Helper ─────────────────────────────────────────────────
async function api(url, opts) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return r.json();
}

// ─── Health Score Ring ──────────────────────────────────────────
function drawScoreRing(score) {
  const canvas = document.getElementById('health-score-ring');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 160, cx = size/2, cy = size/2, r = 65, lw = 10;
  ctx.clearRect(0, 0, size, size);

  // Background ring
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#1E293B'; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();

  // Score arc
  const angle = (score / 100) * Math.PI * 2 - Math.PI / 2;
  const grad = ctx.createLinearGradient(0, 0, size, size);
  if (score >= 75) { grad.addColorStop(0, '#10B981'); grad.addColorStop(1, '#06B6D4'); }
  else if (score >= 50) { grad.addColorStop(0, '#F59E0B'); grad.addColorStop(1, '#F97316'); }
  else { grad.addColorStop(0, '#EF4444'); grad.addColorStop(1, '#F97316'); }
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, angle);
  ctx.strokeStyle = grad; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();

  document.getElementById('health-score-val').textContent = score + '%';
  document.getElementById('health-score-val').style.color =
    score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
}

// ─── Dashboard ──────────────────────────────────────────────────
async function loadDashboard() {
  const [summary, tipsData] = await Promise.all([
    api('/api/biomarkers/summary'),
    api('/api/health-ai/tips'),
  ]);

  if (summary.success) {
    drawScoreRing(summary.score);
    const st = summary.stats;
    document.getElementById('score-stats').innerHTML =
      `<span class="stat-chip normal">${st.normal} Normal</span>` +
      `<span class="stat-chip borderline">${st.borderline} Borderline</span>` +
      `<span class="stat-chip critical">${st.critical} Critical</span>` +
      (summary.activityModifier ? `<span class="stat-chip ${summary.activityModifier > 0 ? 'normal' : 'critical'}" style="width:100%; justify-content:center; margin-top:8px;">🏃 ${summary.activityModifier > 0 ? '+' : ''}${summary.activityModifier} Activity Impact</span>` : '');

    document.getElementById('last-updated').textContent = 'Last: ' + summary.date;

    const v = summary.vitals;
    document.getElementById('vitals-grid').innerHTML = [
      vitalCard('Blood Pressure', v.bp, 'mmHg', v.bpStatus),
      vitalCard('SpO2', v.spo2, '%', v.spo2Status),
      vitalCard('Pulse Rate', v.pulse, 'bpm', v.pulseStatus),
      vitalCard('Temperature', v.temp, '°F', v.tempStatus),
      vitalCard('BMI', v.bmi, 'kg/m²', v.bmiStatus),
      vitalCard('Blood Sugar', v.sugar, 'mg/dL', v.sugarStatus),
    ].join('');
  }

  // Categories
  const catData = await api('/api/biomarkers');
  if (catData.success) {
    document.getElementById('categories-grid').innerHTML = catData.categories.map(cat => {
      const markers = cat.biomarkers.map(b =>
        `<div class="cat-marker-dot ${b.status}"></div>`
      ).join('');
      return `<div class="category-card" style="--cat-color:${cat.color}" onclick="showCategory('${cat.id}')">
        <div class="cat-header">
          <span class="cat-name">${cat.name}</span>
          <span class="cat-count">${cat.biomarkers.length} tests</span>
        </div>
        <div class="cat-desc">${cat.description}</div>
        <div class="cat-markers">${markers}</div>
      </div>`;
    }).join('');
  }

  // Tips
  if (tipsData.success) {
    document.getElementById('tips-grid').innerHTML = tipsData.tips.map(t => `
      <div class="tip-card ${t.severity}">
        <div class="tip-header">
          <span class="tip-cat">${t.category}</span>
          <span class="tip-sev ${t.severity}">${t.severity}</span>
        </div>
        <div class="tip-text">${t.tip}</div>
      </div>
    `).join('');
  }
}

function vitalCard(label, val, unit, status) {
  return `<div class="vital-card ${status}">
    <div class="vital-label">${label}</div>
    <div class="vital-value">${val ?? '—'} <span class="vital-unit">${unit}</span></div>
    <span class="vital-status ${status}">${status}</span>
  </div>`;
}

// ─── Biomarkers Page ────────────────────────────────────────────
async function loadBiomarkers(catId) {
  const data = await api('/api/biomarkers');
  if (!data.success) return;

  // Tab nav
  const nav = document.getElementById('bio-nav');
  nav.innerHTML = data.categories.map(c =>
    `<button class="bio-tab ${c.id === (catId || data.categories[0].id) ? 'active' : ''}" onclick="showCategory('${c.id}')">${c.name}</button>`
  ).join('');

  const activeCat = catId || data.categories[0].id;
  const catDetail = await api(`/api/biomarkers/category/${activeCat}`);
  if (!catDetail.success) return;

  document.getElementById('bio-content').innerHTML = catDetail.biomarkers.map(b => {
    const lat = b.latest;
    const val = lat ? lat.value : 0;
    const status = lat ? lat.status : 'unknown';
    const pct = b.max > b.min ? ((val - b.min) / (b.max - b.min)) * 100 : 50;
    const normalStart = ((b.normalLow - b.min) / (b.max - b.min)) * 100;
    const normalEnd = ((b.normalHigh - b.min) / (b.max - b.min)) * 100;

    return `<div class="biomarker-card ${status}">
      <div class="bio-name">${b.name}</div>
      <div class="bio-val-row">
        <span class="bio-val">${val}</span>
        <span class="bio-unit">${b.unit}</span>
      </div>
      <div class="bio-range-bar">
        <div class="bio-range-fill ${status}" style="width:${Math.min(pct, 100)}%"></div>
      </div>
      <div class="bio-range-label">
        <span>${b.min} ${b.unit}</span>
        <span style="color:var(--green)">Normal: ${b.normalLow}–${b.normalHigh}</span>
        <span>${b.max} ${b.unit}</span>
      </div>
      <div class="bio-mini-chart"><canvas id="mini-${b.id}" height="40"></canvas></div>
    </div>`;
  }).join('');

  // Draw mini trend charts
  catDetail.biomarkers.forEach(b => {
    const canvas = document.getElementById(`mini-${b.id}`);
    if (!canvas || !b.trend.length) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.offsetWidth * 2;
    canvas.height = 80;
    canvas.style.width = '100%';
    canvas.style.height = '40px';
    ctx.scale(2, 2);
    const w = canvas.width / 2, h = 40;
    const vals = b.trend.map(t => t.value).filter(v => v !== null);
    if (vals.length < 2) return;
    const mn = Math.min(...vals) * 0.98, mx = Math.max(...vals) * 1.02;
    const rng = mx - mn || 1;
    const step = w / (vals.length - 1);
    const color = b.latest?.status === 'normal' ? '#10B981' : b.latest?.status === 'critical' ? '#EF4444' : '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(0, h - ((vals[0] - mn) / rng) * h * 0.85);
    for (let i = 1; i < vals.length; i++) {
      ctx.lineTo(i * step, h - ((vals[i] - mn) / rng) * h * 0.85);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  });
}

window.showCategory = function(catId) {
  navigate('biomarkers');
  setTimeout(() => loadBiomarkers(catId), 50);
};

// ─── Progress Page ──────────────────────────────────────────────
async function loadProgress() {
  // Populate biomarker selector
  const data = await api('/api/biomarkers');
  if (!data.success) return;
  const sel = document.getElementById('progress-biomarker');
  sel.innerHTML = data.categories.map(cat =>
    `<optgroup label="${cat.name}">` +
    cat.biomarkers.map(b => `<option value="${b.id}">${b.name} (${b.unit})</option>`).join('') +
    `</optgroup>`
  ).join('');

  sel.onchange = () => updateProgressChart(sel.value);
  updateProgressChart(sel.value);
}

async function updateProgressChart(key, days = 30) {
  const data = await api(`/api/biomarkers/history/${key}?days=${days}`);
  if (!data.success) return;

  const labels = data.history.map(h => h.date.slice(5));
  const vals = data.history.map(h => h.value);

  if (progressChart) progressChart.destroy();
  const ctx = document.getElementById('progress-chart').getContext('2d');
  progressChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: data.name,
          data: vals,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
        {
          label: 'Normal High',
          data: Array(labels.length).fill(data.normalHigh),
          borderColor: 'rgba(16,185,129,0.4)',
          borderDash: [5, 5],
          pointRadius: 0,
          borderWidth: 1,
          fill: false,
        },
        {
          label: 'Normal Low',
          data: Array(labels.length).fill(data.normalLow),
          borderColor: 'rgba(16,185,129,0.4)',
          borderDash: [5, 5],
          pointRadius: 0,
          borderWidth: 1,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } } },
      },
      scales: {
        x: {
          ticks: { color: '#64748B', font: { size: 10 } },
          grid: { color: 'rgba(30,41,59,0.5)' },
        },
        y: {
          ticks: { color: '#64748B', font: { size: 10 } },
          grid: { color: 'rgba(30,41,59,0.5)' },
        },
      },
    },
  });

  // Stats
  const min = Math.min(...vals), max = Math.max(...vals);
  const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  const latest = vals[vals.length - 1];
  const trend = vals.length > 1 ? (vals[vals.length - 1] > vals[0] ? 'Increasing' : vals[vals.length - 1] < vals[0] ? 'Decreasing' : 'Stable') : 'N/A';

  document.getElementById('progress-stats').innerHTML = `
    <div class="prog-stat"><div class="prog-stat-val">${latest}</div><div class="prog-stat-label">Latest (${data.unit})</div></div>
    <div class="prog-stat"><div class="prog-stat-val">${avg}</div><div class="prog-stat-label">Average</div></div>
    <div class="prog-stat"><div class="prog-stat-val">${min}–${max}</div><div class="prog-stat-label">Range</div></div>
    <div class="prog-stat"><div class="prog-stat-val" style="color:${trend === 'Increasing' ? 'var(--amber)' : trend === 'Decreasing' ? 'var(--blue)' : 'var(--green)'}">${trend}</div><div class="prog-stat-label">Trend</div></div>
  `;
}

// ─── Diet Page ──────────────────────────────────────────────────
async function loadDiet() {
  const [comp, planData] = await Promise.all([
    api('/api/diet/comparison?days=7'),
    api('/api/diet/plan'),
  ]);

  if (comp.success) {
    // Chart
    const labels = comp.comparison.map(c => c.date.slice(5));
    if (dietChart) dietChart.destroy();
    const ctx = document.getElementById('diet-chart').getContext('2d');
    dietChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Actual Calories',
            data: comp.comparison.map(c => c.actual.calories),
            backgroundColor: 'rgba(59,130,246,0.7)',
            borderRadius: 4,
          },
          {
            label: 'Target Calories',
            data: comp.comparison.map(c => c.target.calories),
            backgroundColor: 'rgba(16,185,129,0.4)',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } } } },
        scales: {
          x: { ticks: { color: '#64748B' }, grid: { color: 'rgba(30,41,59,0.3)' } },
          y: { ticks: { color: '#64748B' }, grid: { color: 'rgba(30,41,59,0.3)' } },
        },
      },
    });

    // Macro breakdown
    const a = comp.avgActual, t = comp.target;
    document.getElementById('diet-breakdown').innerHTML = ['calories', 'protein', 'carbs', 'fat', 'fiber'].map(k => {
      const diff = a[k] - t[k];
      const cls = Math.abs(diff) < t[k] * 0.1 ? 'ok' : diff > 0 ? 'over' : 'under';
      const unit = k === 'calories' ? 'kcal' : 'g';
      return `<div class="macro-card">
        <div class="macro-val">${a[k]}</div>
        <div class="macro-label">${k.charAt(0).toUpperCase() + k.slice(1)} (${unit})</div>
        <div class="macro-diff ${cls}">${diff > 0 ? '+' : ''}${diff} vs target</div>
      </div>`;
    }).join('');
  }

  // Plan
  if (planData.success && planData.plan) {
    document.getElementById('diet-plan').innerHTML = planData.plan.meals.map(m => `
      <div class="plan-meal">
        <div class="plan-meal-type">${m.meal}</div>
        <div class="plan-meal-desc">${m.suggestion}</div>
        <div class="plan-meal-cal">${m.targetCalories} kcal target</div>
      </div>
    `).join('');
  }

  // Form handler
  document.getElementById('diet-form').onsubmit = async function(e) {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0];
    const meal = {
      meal: document.getElementById('meal-type').value,
      items: document.getElementById('meal-items').value.split(',').map(s => s.trim()),
      calories: parseInt(document.getElementById('meal-cal').value) || 0,
      protein: parseInt(document.getElementById('meal-protein').value) || 0,
      carbs: parseInt(document.getElementById('meal-carbs').value) || 0,
      fat: parseInt(document.getElementById('meal-fat').value) || 0,
      fiber: 0,
    };
    await api('/api/diet/log', {
      method: 'POST',
      body: JSON.stringify({ date: today, meals: [meal] }),
    });
    this.reset();
    loadDiet();
  };
}

// ─── Activity Page ──────────────────────────────────────────────
async function loadActivity() {
  const data = await api('/api/activity/summary');
  if (!data.success) return;

  // Render Connected Devices
  const ALL_PROVIDERS = [
    { name: 'Apple Health', icon: '🍏' },
    { name: 'Google Fit', icon: '🏃' },
    { name: 'Garmin Connect', icon: '⌚' },
    { name: 'Fitbit', icon: '📊' }
  ];

  document.getElementById('devices-grid').innerHTML = ALL_PROVIDERS.map(p => {
    const dev = data.devices.find(d => d.provider === p.name);
    const isConn = !!dev;
    return `
      <div class="device-card">
        <div class="device-icon">${p.icon}</div>
        <div class="device-name">${p.name}</div>
        <div class="device-status ${isConn ? 'connected' : 'disconnected'}">
          ${isConn ? 'Connected ✓' : 'Not Connected'}
        </div>
        ${isConn 
          ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:auto">Last synced: Today</div>`
          : `<button class="btn-connect" data-provider="${p.name}">Connect Device</button>` 
        }
      </div>
    `;
  }).join('');

  document.querySelectorAll('.btn-connect').forEach(btn => {
    btn.onclick = () => window.connectDevice(btn.dataset.provider);
  });

  // Render KPIs
  const kpis = data.kpis;
  document.getElementById('activity-kpis').innerHTML = `
    <div class="kpi-card" style="--kpi-color: var(--blue)">
      <div class="kpi-title">Steps</div>
      <div class="kpi-val">${kpis.steps.toLocaleString()}</div>
      <div class="kpi-unit">Target: 10,000</div>
    </div>
    <div class="kpi-card" style="--kpi-color: var(--amber)">
      <div class="kpi-title">Active Minutes</div>
      <div class="kpi-val">${kpis.activeMinutes}</div>
      <div class="kpi-unit">Target: 30 mins</div>
    </div>
    <div class="kpi-card" style="--kpi-color: var(--red)">
      <div class="kpi-title">Calories Burned</div>
      <div class="kpi-val">${kpis.calories.toLocaleString()}</div>
      <div class="kpi-unit">kcal</div>
    </div>
    <div class="kpi-card" style="--kpi-color: var(--purple)">
      <div class="kpi-title">Resting HR</div>
      <div class="kpi-val">${kpis.restingHR}</div>
      <div class="kpi-unit">bpm</div>
    </div>
  `;

  // Handle Form
  const form = document.getElementById('activity-form');
  form.onsubmit = async function(e) {
    e.preventDefault();
    const type = document.getElementById('exercise-type').value;
    const duration = document.getElementById('exercise-duration').value;
    const intensity = document.getElementById('exercise-intensity').value;
    
    if (!type || !duration || !intensity) return;

    const res = await api('/api/activity/log', {
      method: 'POST',
      body: JSON.stringify({ type, duration, intensity })
    });

    if (res.success) {
      document.getElementById('activity-success').textContent = 'Activity Saved!';
      document.getElementById('activity-success').classList.add('show');
      setTimeout(() => { document.getElementById('activity-success').classList.remove('show'); }, 3000);
      form.reset();
      loadActivity();
    }
  };
}

window.connectDevice = async function(provider) {
  const res = await api('/api/activity/connect', {
    method: 'POST',
    body: JSON.stringify({ provider })
  });
  if (res.success) loadActivity();
};

// ─── AI Chat ────────────────────────────────────────────────────
function initChat() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const msgs = document.getElementById('chat-messages');

  async function sendMessage(text) {
    if (!text.trim()) return;
    // User message
    msgs.innerHTML += `<div class="chat-msg user"><div class="msg-avatar">You</div><div class="msg-bubble">${escHtml(text)}</div></div>`;
    msgs.scrollTop = msgs.scrollHeight;

    // Bot response
    const data = await api('/api/health-ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    });

    let html = data.response || 'Sorry, I could not process that.';
    // Convert markdown-like formatting
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    // Simple table rendering
    html = html.replace(/\|(.+)\|/g, function(match) {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => c.trim().match(/^-+$/))) return '';
      const tag = cells[0].match(/^[A-Z]/) ? 'td' : 'td';
      return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
    });
    if (html.includes('<tr>')) html = '<table>' + html + '</table>';

    msgs.innerHTML += `<div class="chat-msg bot"><div class="msg-avatar">AI</div><div class="msg-bubble">${html}</div></div>`;
    msgs.scrollTop = msgs.scrollHeight;
  }

  form.onsubmit = function(e) {
    e.preventDefault();
    sendMessage(input.value);
    input.value = '';
  };

  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.onclick = () => sendMessage(btn.dataset.q);
  });
}

function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ─── Period Buttons (Progress) ──────────────────────────────────
function initPeriodBtns() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sel = document.getElementById('progress-biomarker');
      updateProgressChart(sel.value, parseInt(btn.dataset.days));
    });
  });
}

// ─── Menu Toggle (Mobile) ───────────────────────────────────────
function initMenuToggle() {
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

// ─── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      navigate(this.dataset.page);
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  initMenuToggle();
  initPeriodBtns();
  initChat();
  loadDashboard();
});

})();
