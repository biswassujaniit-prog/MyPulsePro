// ============================================
// MyPulsePro — Activity & Wearables API
// ============================================
const express = require('express');
const router = express.Router();
const db = require('../aws-sim');

// GET /api/activity/summary — Today's KPIs and connected devices
router.get('/summary', (req, res) => {
  const userId = 'user-001';
  
  // 1. Get Connected Devices
  const devices = db.query('WearableDevices', userId);

  // 2. Calculate Today's KPIs from ActivityLogs
  const todayDate = new Date().toISOString().split('T')[0];
  const logs = db.query('ActivityLogs', userId, {
    skBetween: [todayDate, todayDate],
  });

  // Calculate totals for today
  let totalSteps = 0;
  let totalCalories = 0;
  let totalActiveMinutes = 0;
  
  // Base daily movement (simulating random movement even without logged exercise)
  if (logs.length === 0) {
    totalSteps = 1200;
    totalCalories = 80;
    totalActiveMinutes = 10;
  }

  logs.forEach(log => {
    totalSteps += log.steps || 0;
    totalCalories += log.calories || 0;
    totalActiveMinutes += log.duration || 0;
  });

  res.json({
    success: true,
    kpis: {
      steps: totalSteps,
      calories: totalCalories,
      activeMinutes: totalActiveMinutes,
      restingHR: devices.length > 0 ? 65 : '--', // Mock 65 bpm if a device is connected
    },
    devices: devices.map(d => ({
      provider: d.provider,
      connected: d.connected,
      lastSync: d.lastSync,
    })),
  });
});

// POST /api/activity/connect — Simulate connecting a wearable device
router.post('/connect', (req, res) => {
  const userId = 'user-001';
  const { provider } = req.body; // e.g., 'Apple Health', 'Garmin', 'Fitbit'

  if (!provider) return res.status(400).json({ error: 'Provider is required' });

  // Mock saving the connection
  const device = db.putItem('WearableDevices', {
    pk: userId,
    sk: provider,
    provider,
    connected: true,
    lastSync: new Date().toISOString(),
  });

  // When a user connects a device for the first time, let's inject a "synced" exercise log for today
  const today = new Date().toISOString().split('T')[0];
  db.putItem('ActivityLogs', {
    pk: userId,
    sk: `${today}-sync-${Date.now()}`,
    date: today,
    type: 'Device Sync',
    duration: 45, // 45 active minutes
    calories: 320,
    steps: 6500,
    source: provider
  });

  res.json({ success: true, message: `${provider} connected successfully! Initial data synced.`, device });
});

// POST /api/activity/log — Manually log an exercise
router.post('/log', (req, res) => {
  const userId = 'user-001';
  const { type, duration, intensity } = req.body;

  if (!type || !duration || !intensity) {
    return res.status(400).json({ error: 'Type, duration, and intensity are required' });
  }

  // Calculate dummy calories and steps based on intensity
  const intensityMultiplier = intensity === 'High' ? 10 : intensity === 'Medium' ? 7 : 4;
  const calories = Math.round(duration * intensityMultiplier);
  const steps = type.toLowerCase() === 'running' || type.toLowerCase() === 'walking' 
                ? Math.round(duration * (intensity === 'High' ? 160 : 100)) 
                : 0;

  const today = new Date().toISOString().split('T')[0];
  const logId = `${today}-manual-${Date.now()}`;

  const entry = db.putItem('ActivityLogs', {
    pk: userId,
    sk: logId,
    date: today,
    type,
    duration: parseInt(duration),
    intensity,
    calories,
    steps,
    source: 'Manual'
  });

  res.json({ success: true, message: 'Activity logged successfully', entry });
});

module.exports = router;
