// ============================================
// MyPulsePro — Diet API Routes
// ============================================
const express = require('express');
const router = express.Router();
const db = require('../aws-sim');

// GET /api/diet/log — Get diet logs (last N days)
router.get('/log', (req, res) => {
  const userId = 'user-001';
  const days = parseInt(req.query.days) || 7;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  const logs = db.query('DietLogs', userId, {
    skBetween: [start.toISOString().split('T')[0], now.toISOString().split('T')[0]],
  });

  res.json({ success: true, logs });
});

// POST /api/diet/log — Upload new diet entry
router.post('/log', (req, res) => {
  const userId = 'user-001';
  const { date, meals } = req.body;
  if (!date || !meals || !Array.isArray(meals)) {
    return res.status(400).json({ error: 'date and meals[] required' });
  }

  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein: acc.protein + (m.protein || 0),
    carbs: acc.carbs + (m.carbs || 0),
    fat: acc.fat + (m.fat || 0),
    fiber: acc.fiber + (m.fiber || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  const entry = db.putItem('DietLogs', {
    pk: userId,
    sk: date,
    date,
    meals,
    totals,
  });

  res.json({ success: true, entry });
});

// GET /api/diet/plan — Get recommended diet plan
router.get('/plan', (req, res) => {
  const userId = 'user-001';
  const plan = db.getItem('DietPlans', userId, 'recommended');
  if (!plan) return res.json({ success: true, plan: null });
  res.json({ success: true, plan });
});

// GET /api/diet/comparison — Compare actual vs recommended (last 7 days)
router.get('/comparison', (req, res) => {
  const userId = 'user-001';
  const days = parseInt(req.query.days) || 7;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  const logs = db.query('DietLogs', userId, {
    skBetween: [start.toISOString().split('T')[0], now.toISOString().split('T')[0]],
  });
  const plan = db.getItem('DietPlans', userId, 'recommended');
  const targets = plan ? plan.dailyTargets : { calories: 1800, protein: 60, carbs: 220, fat: 50, fiber: 25 };

  const comparison = logs.map(log => ({
    date: log.date,
    actual: log.totals,
    target: targets,
    diff: {
      calories: log.totals.calories - targets.calories,
      protein: log.totals.protein - targets.protein,
      carbs: log.totals.carbs - targets.carbs,
      fat: log.totals.fat - targets.fat,
      fiber: log.totals.fiber - targets.fiber,
    },
  }));

  const avgActual = logs.length > 0 ? {
    calories: Math.round(logs.reduce((s, l) => s + l.totals.calories, 0) / logs.length),
    protein: Math.round(logs.reduce((s, l) => s + l.totals.protein, 0) / logs.length),
    carbs: Math.round(logs.reduce((s, l) => s + l.totals.carbs, 0) / logs.length),
    fat: Math.round(logs.reduce((s, l) => s + l.totals.fat, 0) / logs.length),
    fiber: Math.round(logs.reduce((s, l) => s + l.totals.fiber, 0) / logs.length),
  } : targets;

  res.json({ success: true, comparison, avgActual, target: targets });
});

module.exports = router;
