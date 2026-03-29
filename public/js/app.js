// ============================================
// MyPulsePro — Main Application
// ============================================
// SPA router + Dashboard + Biomarkers + Progress + Diet + AI Chat

(function() {
'use strict';

// ─── Route Guard ────────────────────────────────────────────────
if (!localStorage.getItem('auth_token')) {
  window.location.replace('/login.html');
  return; // Stop execution
}

// ─── Onboarding Guard ───────────────────────────────────────────
if (!localStorage.getItem('onboarding_complete')) {
  window.location.replace('/onboarding.html');
  return; // Force new users to complete health questionnaire
}

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
  if (page === 'medications') loadMedications();
}

// ─── API Helper ─────────────────────────────────────────────────
async function api(url, methodOrOpts, body) {
  const opts = { headers: { 'Content-Type': 'application/json' } };
  if (methodOrOpts && typeof methodOrOpts === 'string') {
    opts.method = methodOrOpts;
    if (body) opts.body = JSON.stringify(body);
  } else if (methodOrOpts && typeof methodOrOpts === 'object') {
    Object.assign(opts, methodOrOpts);
  }
  const r = await fetch(url, opts);
  return r.json();
}

// ─── Health Score Ring ──────────────────────────────────────────
function drawScoreRing(score) {
  const canvas = document.getElementById('health-score-ring');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 160, centerX = size/2, centerY = size/2, radius = 65; // Renamed cx, cy, r
  
  // Background Ring
  ctx.clearRect(0, 0, size, size); // Use size for clearRect
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.stroke();

  // Dynamic SVG-style Animated Drawing
  const duration = 1500; // ms
  const start = performance.now();
  // const endAngle = -0.5 * Math.PI + (score / 100) * (2 * Math.PI); // Not directly used in drawFrame

  const drawFrame = (now) => {
    let progress = Math.min((now - start) / duration, 1);
    // ease-out cubic
    progress = 1 - Math.pow(1 - progress, 3);
    
    ctx.clearRect(0, 0, size, size); // Use size for clearRect
    
    // Redraw BG
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.stroke();

    if (score > 0) {
      const currentEndAngle = -0.5 * Math.PI + ((score / 100) * (2 * Math.PI) * progress);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -0.5 * Math.PI, currentEndAngle);
      ctx.lineCap = 'round';
      ctx.strokeStyle = score >= 75 ? '#00F0FF' : score >= 50 ? '#FDE047' : '#EF4444';
      
      ctx.shadowBlur = 15;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    }

    if (progress < 1) requestAnimationFrame(drawFrame);
  };
  requestAnimationFrame(drawFrame);

  // Set numeric text
  document.getElementById('health-score-val').textContent = score;
  document.getElementById('health-score-val').style.color = '#F8FAFC'; // White text

  // Calculate Gamified Level
  const levelNames = ['Starter', 'Explorer', 'Achiever', 'Pro', 'Health Ninja'];
  const scoreLevelIdx = Math.min(4, Math.floor(score / 20)); 
  
  // Update Health Score UI
  document.getElementById('health-score-val').textContent = score;
  
  // Dynamic Insights based on score
  const insightText = document.getElementById('insight-text');
  const insightEmoji = document.getElementById('insight-emoji');
  if (insightText) {
    if (score >= 80) { insightText.textContent = "Peak performance detected. Keep it up!"; insightEmoji.textContent = "🚀"; }
    else if (score >= 60) { insightText.textContent = "Good metabolic stability. Try a short walk."; insightEmoji.textContent = "✨"; }
    else { insightText.textContent = "Recovery needed. Optimize sleep tonight."; insightEmoji.textContent = "🌙"; }
  }
}

// ─── Gamification Engine ───
window.triggerConfetti = function() {
  if (typeof confetti !== 'undefined') {
    var duration = 3 * 1000;
    var end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#00F0FF', '#FF4B4B', '#FFFFFF'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#00F0FF', '#FF4B4B', '#FFFFFF'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  }
};

function initXP() {
  let xp = parseInt(localStorage.getItem('app_xp') || '0');
  let level = parseInt(localStorage.getItem('app_level') || '1');
  updateXPUI(xp, level);
}

function addXP(amount) {
  let xp = parseInt(localStorage.getItem('app_xp') || '0');
  let level = parseInt(localStorage.getItem('app_level') || '1');
  
  xp += amount;
  const xpToNext = level * 1000;
  
  if (xp >= xpToNext) {
    xp -= xpToNext;
    level++;
    localStorage.setItem('app_level', level);
    showGamifiedPopup('LEVEL UP!', `You reached Level ${level}`, '🏆');
    window.triggerConfetti();
  }
  
  localStorage.setItem('app_xp', xp);
  updateXPUI(xp, level);
}

function updateXPUI(xp, level) {
  const xpToNext = level * 1000;
  const pct = (xp / xpToNext) * 100;
  
  const fill = document.getElementById('xp-fill');
  const levelLabel = document.getElementById('user-level');
  const valLabel = document.getElementById('xp-value');
  
  if (fill) fill.style.width = pct + '%';
  if (levelLabel) levelLabel.textContent = level;
  if (valLabel) valLabel.textContent = `${xp} / ${xpToNext} XP`;
}

window.completeQuest = function(checkbox) {
  if (checkbox.checked) {
    addXP(150);
    showGamifiedPopup('Quest Step!', '+150 XP', '⭐');
    
    // Check if all quests done
    const total = document.querySelectorAll('#quest-list input').length;
    const done = document.querySelectorAll('#quest-list input:checked').length;
    if (total === done) {
      addXP(500);
      showGamifiedPopup('Daily Quests Clear!', '+500 XP', '👑');
      window.triggerConfetti();
    }
  }
};

// ─── Quick Shortcuts Logic ───
window.quickLogWater = function() {
  let waterCount = parseInt(localStorage.getItem('waterCount') || '0');
  if (waterCount < 8) {
    waterCount++;
    localStorage.setItem('waterCount', waterCount);
    addXP(50);
    showGamifiedPopup('Hydrated!', '+50 XP Recorded', '💧');
    if (waterCount === 8) {
      addXP(200);
      showGamifiedPopup('Hydration Goal!', '+200 XP Bonus', '🌊');
      window.triggerConfetti();
    }
  } else {
    showGamifiedPopup('Fully Hydrated!', 'Daily goal met.', '✅');
  }
};


async function fetchDashboardData() {
  const [summary, tipsData] = await Promise.all([
    api('/api/biomarkers/summary'),
    api('/api/health-ai/tips'),
  ]);
  return { summary, tipsData };
}

// Local Polling loop for Native Dashboard Alerts (Checks med schedules every 30s)
setInterval(async () => {
  if (currentPage !== 'dashboard') return;
  const res = await api('/api/medications');
  if (res.success && res.data) {
    const currentHourMin = new Date().toLocaleTimeString('en-US', { hour12: false, hour: 'numeric', minute: 'numeric' });
    res.data.forEach(m => {
      if (!m.takenToday && m.times.includes(currentHourMin)) {
         showGamifiedPopup(`Time for ${m.name}!`, `Dosage: ${m.dosage}`, '💊');
      }
    });
  }
}, 30000);

async function loadDashboard() {
  initXP();
  
  // Fetch everything in parallel for that "instant" feel
  const [summary, tipsData, activityData, dietData, medData] = await Promise.all([
    api('/api/biomarkers/summary'),
    api('/api/health-ai/tips'),
    api('/api/activity/summary'),
    api('/api/diet/comparison?days=1'), // Just today
    api('/api/medications')
  ]);

  if (summary.success) {
    drawScoreRing(summary.score);
    document.getElementById('last-updated').textContent = 'Last: ' + summary.date;

    const v = summary.vitals;
    document.getElementById('vitals-grid').innerHTML = [
      vitalCard('Pressure', v.bp, 'mmHg', v.bpStatus),
      vitalCard('SpO2', v.spo2, '%', v.spo2Status),
      vitalCard('Pulse', v.pulse, 'bpm', v.pulseStatus),
      vitalCard('BMI', v.bmi, '', v.bmiStatus),
    ].join('');
  }

  // ─── Activity Pulse Update ───
  if (activityData.success) {
    const steps = activityData.kpis.steps;
    document.getElementById('kpi-steps-val').textContent = steps.toLocaleString();
    const pct = Math.min((steps / 10000) * 100, 100);
    document.getElementById('kpi-steps-fill').style.width = pct + '%';
  }

  // ─── Nutrition Pulse Update ───
  if (dietData.success) {
    const today = dietData.comparison[0];
    if (today) {
       document.getElementById('kpi-calories-val').textContent = today.actual.calories;
       const pPct = Math.min((today.actual.protein / (today.target.protein || 50)) * 100, 100);
       const cPct = Math.min((today.actual.carbs / (today.target.carbs || 250)) * 100, 100);
       document.getElementById('fuel-protein').style.width = pPct + '%';
       document.getElementById('fuel-carbs').style.width = cPct + '%';
    }
  }

  // ─── Medications Pulse Update ───
  if (medData.success && medData.data.length > 0) {
    const next = medData.data.find(m => !m.takenToday);
    if (next) {
      document.getElementById('next-med-time').textContent = next.times[0];
      document.getElementById('next-med-name').textContent = next.name;
    }
  }

  // Categories & Tips (Same as before but with entrance animations)
  const catData = await api('/api/biomarkers');
  if (catData.success) {
    document.getElementById('categories-grid').innerHTML = catData.categories.map((cat, idx) => {
      const markers = cat.biomarkers.map(b => `<div class="cat-marker-dot ${b.status}"></div>`).join('');
      return `<div class="category-card cascade delay-${idx % 5}" style="--cat-color:${cat.color}" data-catid="${cat.id}">
        <div class="cat-header">
          <span class="cat-name">${cat.name}</span>
          <span class="cat-count">${cat.biomarkers.length} tests</span>
        </div>
        <div class="cat-markers">${markers}</div>
      </div>`;
    }).join('');

    document.querySelectorAll('.category-card').forEach(card => {
      card.onclick = () => window.showCategory(card.dataset.catid);
    });
  }

  if (tipsData.success) {
    document.getElementById('tips-grid').innerHTML = tipsData.tips.slice(0, 3).map(t => `
      <div class="tip-card ${t.severity}">
        <div class="tip-header">
          <span class="tip-cat">${t.category}</span>
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
      addXP(200);
      document.getElementById('activity-success').textContent = 'Activity Saved! +200 XP';
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

// ─── Gamification Hooks ─────────────────────────────────────────
function initGamification() {
  // Streak System (Mocked to 12 via localStorage if first time)
  let streak = localStorage.getItem('appStreak') || '12';
  localStorage.setItem('appStreak', streak);
  const streakEl = document.getElementById('streak-count');
  if (streakEl) streakEl.textContent = `Day ${streak} Streak!`;

  // Water Tracker
  let waterCount = parseInt(localStorage.getItem('waterCount') || '0');
  const lastWaterDate = localStorage.getItem('lastWaterDate');
  const today = new Date().toDateString();

  if (lastWaterDate !== today) {
    waterCount = 0;
    localStorage.setItem('waterCount', 0);
    localStorage.setItem('lastWaterDate', today);
  }

  const waterEl = document.getElementById('water-count');
  const btnWater = document.getElementById('btn-log-water');

  function updateWaterUI() {
    if (waterEl) waterEl.innerHTML = `${waterCount}<span style="font-size:0.9rem; color:var(--text-muted)">/8</span>`;
    if (btnWater) {
      if (waterCount >= 8) {
        btnWater.textContent = '✓';
        btnWater.style.background = 'var(--green-bg)';
        btnWater.style.color = 'var(--green)';
      } else {
        btnWater.textContent = '+';
      }
    }
  }

  if (btnWater) {
    btnWater.onclick = () => {
      if (waterCount < 8) {
        waterCount++;
        localStorage.setItem('waterCount', waterCount);
        updateWaterUI();
        // Micro-animation
        btnWater.style.transform = 'scale(0.8)';
        setTimeout(() => btnWater.style.transform = 'scale(1)', 150);
        
        // Minor celebration at 8 glasses
        if (waterCount === 8) {
          const card = btnWater.closest('.category-card');
          card.style.borderColor = 'var(--green)';
          card.style.boxShadow = '0 0 20px rgba(16,185,129,0.3)';
          showGamifiedPopup('Hydration Goal Met!', '+50 XP', '💧');
          window.triggerConfetti();
          setTimeout(() => { card.style.borderColor = 'var(--border)'; card.style.boxShadow = 'none'; }, 2000);
        }
      }
    };
  }

  updateWaterUI();
}

// ─── Global Gamified Toast ──────────────────────────────────────
window.showGamifiedPopup = function(title, points, emoji) {
  const existing = document.querySelector('.gamified-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'gamified-popup';
  popup.innerHTML = `
    <div class="icon">${emoji}</div>
    <div class="content">
      <h4>${title}</h4>
      <p>${points}</p>
    </div>
  `;
  document.body.appendChild(popup);

  // Automatically remove after 4 seconds
  setTimeout(() => {
    popup.style.animation = 'slide-up-fade 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) reverse forwards';
    setTimeout(() => popup.remove(), 500);
  }, 4000);
}

// ─── Medications Phase 10 ───────────────────────────────────────
async function loadMedications() {
  const tl = document.getElementById('meds-timeline');
  if (!tl) return;
  tl.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 20px;">Fetching schedule from database...</div>';
  
  const res = await api('/api/medications');
  if (res.success) {
    const meds = res.data;
    if (meds.length === 0) {
      tl.innerHTML = '<div style="color:var(--text-muted); padding:20px;">No active prescriptions. Upload an image to auto-extract schedules.</div>';
      return;
    }
    
    let html = '';
    meds.forEach(med => {
      const isTakenClass = med.takenToday ? 'taken' : '';
      const checkIcon = med.takenToday ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : '';
      html += `
        <div class="timeline-item ${isTakenClass}" id="med-node-${med.id}">
          <div class="pill-card">
             <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                   <h3 style="font-size:1.1rem; color: #fff; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                     ${med.name} ${checkIcon}
                   </h3>
                   <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:12px;">
                     ${med.dosage} • ${med.frequency} • <span style="color:#FDE047">${med.times.join(', ')}</span>
                   </div>
                </div>
                <!-- Action Button -->
                <button class="btn-take-pill" onclick="window.logMedication('${med.id}')">Mark as Taken</button>
             </div>
          </div>
        </div>
      `;
    });
    tl.innerHTML = html;
  }
}

// Drag, Drop, and Upload Tesseract Flow
function initMedicationsDropzone() {
  const fileInput = document.getElementById('prescription-file');
  const dropzone = document.getElementById('med-dropzone');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--teal)'; });
    dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'rgba(255,255,255,0.2)');
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'rgba(255,255,255,0.2)';
      if (e.dataTransfer.files.length) uploadPrescription(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) uploadPrescription(fileInput.files[0]);
    });
  }
  
  // Manual entry button
  const manualBtn = document.getElementById('btn-add-manual-med');
  if (manualBtn) {
    manualBtn.addEventListener('click', async () => {
      const name = document.getElementById('manual-med-name').value.trim();
      const dosage = document.getElementById('manual-med-dose').value.trim();
      const freq = document.getElementById('manual-med-freq').value;
      if (!name) { alert('Please enter medicine name'); return; }
      
      const freqTimes = { OD: ['08:00'], BD: ['08:00','20:00'], TDS: ['08:00','14:00','20:00'], Night: ['22:00'] };
      const res = await api('/api/medications/manual', 'POST', { name, dosage: dosage || '1 Dose', frequency: freq, times: freqTimes[freq] || ['08:00'] });
      if (res.success) {
        showGamifiedPopup('Medicine Added!', `${name} scheduled.`, '💊');
        window.triggerConfetti();
        document.getElementById('manual-med-name').value = '';
        document.getElementById('manual-med-dose').value = '';
        loadMedications();
      }
    });
  }
}

async function uploadPrescription(file) {
  const idleEl = document.getElementById('upload-idle');
  const scanEl = document.getElementById('upload-scanning');
  const resultsEl = document.getElementById('med-parse-results');
  
  idleEl.style.display = 'none';
  scanEl.style.display = 'block';
  resultsEl.innerHTML = '';
  
  const formData = new FormData();
  formData.append('prescription', file);
  
  try {
    const res = await fetch('/api/medications/upload', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    
    scanEl.style.display = 'none';
    idleEl.style.display = 'block';
    
    if (result.success) {
       showGamifiedPopup('AI Parse Successful!', `Extracted ${result.added.length} meds.`, '🤖');
       window.triggerConfetti();
       
       // Show OCR extracted text for transparency
       resultsEl.innerHTML = `
         <div style="background: rgba(0,240,255,0.05); border: 1px solid rgba(0,240,255,0.2); border-radius: 12px; padding: 16px; margin-top: 16px;">
           <h4 style="color: var(--teal); margin-bottom: 8px; font-size: 0.9rem;">📜 OCR Extracted Text</h4>
           <pre style="color: var(--text-muted); font-size: 0.8rem; white-space: pre-wrap; max-height: 150px; overflow-y: auto; font-family: monospace;">${(result.ocrText || '').substring(0, 500)}</pre>
           <p style="color: var(--teal); font-size: 0.85rem; margin-top: 8px;">✔ ${result.added.length} medicine(s) extracted and scheduled</p>
         </div>
       `;
       loadMedications();
    } else {
       resultsEl.innerHTML = `<p style="color: var(--coral);">⚠ ${result.message}. Use manual entry below.</p>`;
    }
  } catch (error) {
    scanEl.style.display = 'none';
    idleEl.style.display = 'block';
    resultsEl.innerHTML = '<p style="color: var(--coral);">⚠ Upload failed. Try manual entry.</p>';
    console.error(error);
  }
}

window.logMedication = async function(id) {
  const res = await api('/api/medications/log', 'POST', { id });
  if (res.success) {
     const node = document.getElementById('med-node-' + id);
     node.classList.add('taken');
     showGamifiedPopup('Dose Logged', '+50 Health Points', '✓');
     window.triggerConfetti();
  }
};

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
  initGamification();
  initMedicationsDropzone();
  loadDashboard();
});

})();
