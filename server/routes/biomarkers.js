// ============================================
// MyPulsePro — Biomarker API Routes
// ============================================
const express = require('express');
const router = express.Router();
const db = require('../aws-sim');

// GET /api/biomarkers — All biomarkers with latest readings
router.get('/', (req, res) => {
  const userId = 'user-001';
  const categories = db.scan('Categories');
  const defs = db.scan('BiomarkerDefs');
  const latest = db.query('Readings', userId, { sortDesc: true, limit: 1 });

  if (!latest.length) return res.json({ success: true, categories: [], latest: null });

  const latestReadings = latest[0].readings;
  const result = categories.map(cat => ({
    id: cat.sk,
    name: cat.name,
    description: cat.description,
    icon: cat.icon,
    color: cat.color,
    biomarkers: cat.biomarkers.map(bKey => {
      const def = defs.find(d => d.sk === bKey);
      const reading = latestReadings[bKey];
      return {
        id: bKey,
        name: def ? def.name : bKey,
        value: reading ? reading.value : null,
        unit: def ? def.unit : '',
        status: reading ? reading.status : 'unknown',
        normalRange: def ? `${def.normalLow}–${def.normalHigh}` : '',
        normalLow: def ? def.normalLow : 0,
        normalHigh: def ? def.normalHigh : 0,
        criticalLow: def ? def.criticalLow : 0,
        criticalHigh: def ? def.criticalHigh : 0,
        min: def ? def.min : 0,
        max: def ? def.max : 0,
        icon: def ? def.icon : '',
      };
    }),
  }));

  res.json({ success: true, categories: result, date: latest[0].date });
});

// GET /api/biomarkers/summary — Health score & stats
router.get('/summary', (req, res) => {
  const userId = 'user-001';
  const latest = db.query('Readings', userId, { sortDesc: true, limit: 1 });
  if (!latest.length) return res.json({ success: true, score: 0, stats: {} });

  const readings = latest[0].readings;
  let normal = 0, borderline = 0, critical = 0, total = 0;
  for (const [, r] of Object.entries(readings)) {
    total++;
    if (r.status === 'normal') normal++;
    else if (r.status === 'critical') critical++;
    else borderline++;
  }
  const score = Math.round((normal / total) * 100);

  // Calculate Activity Modifier
  let activityModifier = 0;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const actLogs = db.query('ActivityLogs', userId, { skBetween: [todayStr, todayStr] });
    let todayMins = 0;
    actLogs.forEach(l => { todayMins += l.duration || 0; });
    
    // Immediate daily reward for activity
    if (todayMins >= 45) activityModifier = 8;
    else if (todayMins >= 20) activityModifier = 4;
    else if (todayMins < 10) activityModifier = -5;
  } catch (e) { console.error('Error calculating activity modifier', e); }

  const finalScore = Math.min(100, Math.max(0, score + activityModifier));

  // Key vitals
  const vitals = {
    bp: readings.bp_systolic ? `${readings.bp_systolic.value}/${readings.bp_diastolic ? readings.bp_diastolic.value : '?'}` : 'N/A',
    bpStatus: readings.bp_systolic ? readings.bp_systolic.status : 'unknown',
    spo2: readings.spo2 ? readings.spo2.value : null,
    spo2Status: readings.spo2 ? readings.spo2.status : 'unknown',
    pulse: readings.pulse ? readings.pulse.value : null,
    pulseStatus: readings.pulse ? readings.pulse.status : 'unknown',
    temp: readings.body_temp ? readings.body_temp.value : null,
    tempStatus: readings.body_temp ? readings.body_temp.status : 'unknown',
    bmi: readings.bmi ? readings.bmi.value : null,
    bmiStatus: readings.bmi ? readings.bmi.status : 'unknown',
    sugar: readings.blood_sugar ? readings.blood_sugar.value : null,
    sugarStatus: readings.blood_sugar ? readings.blood_sugar.status : 'unknown',
  };

  res.json({
    success: true, score: finalScore, baseScore: score, activityModifier, date: latest[0].date,
    stats: { total, normal, borderline, critical },
    vitals,
  });
});

// GET /api/biomarkers/history/:key — Time-series for a biomarker
router.get('/history/:key', (req, res) => {
  const userId = 'user-001';
  const { key } = req.params;
  const days = parseInt(req.query.days) || 30;

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().split('T')[0];
  const endStr = now.toISOString().split('T')[0];

  const records = db.query('Readings', userId, { skBetween: [startStr, endStr] });
  const def = db.getItem('BiomarkerDefs', 'DEF', key);

  const history = records.map(r => ({
    date: r.date,
    value: r.readings[key] ? r.readings[key].value : null,
    status: r.readings[key] ? r.readings[key].status : null,
  })).filter(h => h.value !== null);

  res.json({
    success: true,
    key,
    name: def ? def.name : key,
    unit: def ? def.unit : '',
    normalLow: def ? def.normalLow : 0,
    normalHigh: def ? def.normalHigh : 0,
    history,
  });
});

// GET /api/biomarkers/category/:id — Detailed category view
router.get('/category/:id', (req, res) => {
  const userId = 'user-001';
  const { id } = req.params;
  const cat = db.scan('Categories').find(c => c.sk === id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  const defs = db.scan('BiomarkerDefs');
  const readings = db.query('Readings', userId, { sortDesc: true, limit: 7 });

  const biomarkers = cat.biomarkers.map(bKey => {
    const def = defs.find(d => d.sk === bKey);
    const trend = readings.map(r => ({
      date: r.date,
      value: r.readings[bKey] ? r.readings[bKey].value : null,
      status: r.readings[bKey] ? r.readings[bKey].status : null,
    })).reverse();

    return {
      id: bKey,
      name: def ? def.name : bKey,
      unit: def ? def.unit : '',
      latest: trend.length ? trend[trend.length - 1] : null,
      normalLow: def ? def.normalLow : 0,
      normalHigh: def ? def.normalHigh : 0,
      min: def ? def.min : 0,
      max: def ? def.max : 0,
      trend,
    };
  });

  res.json({
    success: true,
    category: { id, name: cat.name, description: cat.description, color: cat.color, icon: cat.icon },
    biomarkers,
  });
});

module.exports = router;
