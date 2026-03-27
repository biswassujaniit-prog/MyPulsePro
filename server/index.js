// ============================================
// MyPulsePro — Production Server
// ============================================
const express = require('express');
const path = require('path');
const setupSecurity = require('./middleware/security');
const { seedDatabase } = require('./seed-data');
const db = require('./aws-sim');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Security ───────────────────────────────────────────────────
setupSecurity(app);

// ─── Body parsing ───────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ─────────────────────────────────────────────────
app.use('/api/biomarkers', require('./routes/biomarkers'));
app.use('/api/diet', require('./routes/diet'));
app.use('/api/health-ai', require('./routes/health-ai'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/auth', require('./routes/auth')); // Gamified Auth
app.use('/api/medications', require('./routes/medications')); // Phase 10: Medicine Tracker

// ─── Gamification & Alert Engines ───────────────────────────────
require('./services/alertEngine');

// ─── SPA catch-all ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ──────────────────────────────────────────────────────
// Seed data if database is empty
const existingData = db.scan('BiomarkerDefs');
if (!existingData || existingData.length === 0) {
  console.log('\n  [MyPulsePro] First run — seeding database...');
  seedDatabase();
}

app.listen(PORT, () => {
  console.log(`
  =====================================================
   MyPulsePro — Biomarker Tracking Platform
   http://localhost:${PORT}
  =====================================================

   API Endpoints:
     GET  /api/biomarkers           — All biomarkers
     GET  /api/biomarkers/summary   — Health score & vitals
     GET  /api/biomarkers/history/:key  — Trend data
     GET  /api/biomarkers/category/:id  — Category detail
     GET  /api/diet/log             — Diet history
     POST /api/diet/log             — Upload diet
     GET  /api/diet/plan            — Recommended diet
     GET  /api/diet/comparison      — Actual vs recommended
     GET  /api/health-ai/tips       — Pro tips
     POST /api/health-ai/chat       — AI health assistant

   AWS DynamoDB: Simulated (JSON persistence in /data)
   Security: Helmet + CORS + Rate Limiting
  `);
});
