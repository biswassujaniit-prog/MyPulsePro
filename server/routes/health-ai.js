// ============================================
// MyPulsePro — Health AI Routes
// ============================================
const express = require('express');
const router = express.Router();
const db = require('../aws-sim');
const { BIOMARKER_DEFS } = require('../seed-data');

// ─── Rule-based Health AI Engine ────────────────────────────────
// ─── AI-Simulated Health Engine ────────────────────────────────
function generateTips(readings) {
  const tips = [];
  const intros = ['Based on my analysis', 'I noticed that', 'Looking at your recent panel', 'An important finding is'];

  function getRandomIntro() { return intros[Math.floor(Math.random() * intros.length)]; }

  if (readings.bp_systolic && readings.bp_systolic.status !== 'normal') {
    tips.push({
      category: 'Cardiac', severity: readings.bp_systolic.status,
      tip: `${getRandomIntro()}, your blood pressure is ${readings.bp_systolic.value}/${readings.bp_diastolic ? readings.bp_diastolic.value : '?'} mmHg. Activity helps: try adding 15 mins of brisk walking to lower this.`,
    });
  }

  if (readings.blood_sugar && readings.blood_sugar.status !== 'normal') {
    tips.push({
      category: 'Diabetes', severity: readings.blood_sugar.status,
      tip: `${getRandomIntro()}, your random blood sugar (${readings.blood_sugar.value} mg/dL) is elevated. Reduce refined carbs and walk for 10 minutes right after your largest meal.`,
    });
  }

  if (readings.hba1c && readings.hba1c.value > 5.7) {
    tips.push({
      category: 'Diabetes', severity: readings.hba1c.value > 6.5 ? 'critical' : 'borderline',
      tip: `Your HbA1c of ${readings.hba1c.value}% indicates a need for lifestyle changes. Focus on a high-fiber, low-glycemic index diet to improve insulin sensitivity.`,
    });
  }

  if (readings.hemoglobin && readings.hemoglobin.status !== 'normal') {
    tips.push({
      category: 'General', severity: readings.hemoglobin.status,
      tip: `Your hemoglobin is low (${readings.hemoglobin.value} g/dL). Pair iron-rich foods like spinach or lentils with Vitamin C (like a squeeze of lemon) for better absorption.`,
    });
  }

  if (readings.ldl && readings.ldl.value > 100) {
    tips.push({
      category: 'Cardiac', severity: readings.ldl.value > 160 ? 'critical' : 'borderline',
      tip: `LDL ("bad" cholesterol) is elevated at ${readings.ldl.value} mg/dL. Swap saturated fats for healthy omega-3s—try adding chia seeds or walnuts to your breakfast.`,
    });
  }

  // If everything is normal
  if (tips.length === 0) {
    tips.push({
      category: 'General', severity: 'normal',
      tip: 'Your biomarker panel looks fantastic! All your major vitals are completely stable. To maintain this, ensure you are getting 7-8 hours of quality sleep tonight.',
    });
    tips.push({
      category: 'Activity', severity: 'normal',
      tip: 'Stay consistent with your daily 10,000 steps goal to keep your cardiovascular system in prime condition.',
    });
  }

  // LLM AI Simulation: We only want exactly 2 to 3 the most highly relevant / critical tips
  tips.sort((a, b) => (a.severity === 'critical' ? -1 : 1));
  return tips.slice(0, 3);
}

// ─── AI Chat Response Generator ─────────────────────────────────
function generateChatResponse(message, readings, defs) {
  const msg = message.toLowerCase();

  // Lipid profile queries
  if (msg.includes('lipid') || msg.includes('cholesterol') || msg.includes('hdl') || msg.includes('ldl')) {
    const tc = readings.total_cholesterol;
    const tg = readings.triglycerides;
    const hdl = readings.hdl;
    const ldl = readings.ldl;
    const ratio = readings.tc_hdl_ratio;
    return {
      response: `**Lipid Profile Summary:**\n\n` +
        `| Marker | Value | Normal Range | Status |\n|---|---|---|---|\n` +
        `| Total Cholesterol | ${tc ? tc.value + ' mg/dL' : 'N/A'} | 125–200 mg/dL | ${tc ? tc.status : '-'} |\n` +
        `| Triglycerides | ${tg ? tg.value + ' mg/dL' : 'N/A'} | 50–150 mg/dL | ${tg ? tg.status : '-'} |\n` +
        `| HDL (Good) | ${hdl ? hdl.value + ' mg/dL' : 'N/A'} | 40–60 mg/dL | ${hdl ? hdl.status : '-'} |\n` +
        `| LDL (Bad) | ${ldl ? ldl.value + ' mg/dL' : 'N/A'} | 50–100 mg/dL | ${ldl ? ldl.status : '-'} |\n` +
        `| TC/HDL Ratio | ${ratio ? ratio.value : 'N/A'} | <4.5 | ${ratio ? ratio.status : '-'} |\n\n` +
        `${ldl && ldl.value > 100 ? '⚠️ Your LDL is elevated. Consider reducing saturated fats and increasing fiber.\n' : ''}` +
        `${hdl && hdl.value < 40 ? '⚠️ HDL is low. Exercise and healthy fats (nuts, olive oil) can help raise it.\n' : ''}` +
        `${tc && tc.status === 'normal' && ldl && ldl.status === 'normal' ? '✅ Your lipid profile looks healthy!\n' : ''}`,
      type: 'analysis',
    };
  }

  // Blood pressure
  if (msg.includes('blood pressure') || msg.includes('bp') || msg.includes('hypertension')) {
    const sys = readings.bp_systolic;
    const dia = readings.bp_diastolic;
    let category = 'Normal';
    if (sys && sys.value >= 140) category = 'Stage 2 Hypertension';
    else if (sys && sys.value >= 130) category = 'Stage 1 Hypertension';
    else if (sys && sys.value >= 120) category = 'Elevated';

    return {
      response: `**Blood Pressure: ${sys ? sys.value : '?'}/${dia ? dia.value : '?'} mmHg**\n\nClassification: **${category}**\n\n` +
        `| Category | Systolic | Diastolic |\n|---|---|---|\n` +
        `| Normal | <120 | <80 |\n| Elevated | 120-129 | <80 |\n| Stage 1 HTN | 130-139 | 80-89 |\n| Stage 2 HTN | ≥140 | ≥90 |\n\n` +
        (sys && sys.value >= 130 ? '**Recommendations:** Reduce salt (<5g/day), exercise 30 min/day, manage stress, monitor weekly.' : '✅ Blood pressure is well controlled.'),
      type: 'analysis',
    };
  }

  // Sugar / diabetes
  if (msg.includes('sugar') || msg.includes('diabetes') || msg.includes('glucose') || msg.includes('hba1c')) {
    const bs = readings.blood_sugar;
    const a1c = readings.hba1c;
    return {
      response: `**Diabetes Panel:**\n\n` +
        `- Random Blood Sugar: **${bs ? bs.value + ' mg/dL' : 'N/A'}** (Normal: 70–140)\n` +
        `- HbA1c: **${a1c ? a1c.value + '%' : 'N/A'}** (Normal: 4–5.7%)\n\n` +
        (a1c && a1c.value > 6.5 ? '🔴 HbA1c indicates diabetes. Please consult an endocrinologist.\n' :
         a1c && a1c.value > 5.7 ? '🟡 Pre-diabetic range. Lifestyle changes recommended.\n' :
         '🟢 Values within normal range.') +
        '\n**Tips:** Reduce refined carbs, eat more fiber, walk 30 min after meals.',
      type: 'analysis',
    };
  }

  // Diet advice
  if (msg.includes('eat') || msg.includes('diet') || msg.includes('food') || msg.includes('nutrition')) {
    return {
      response: `**Personalized Diet Recommendations:**\n\n` +
        `Based on your biomarkers:\n\n` +
        (readings.bmi && readings.bmi.value > 25 ? '- 🥗 **Calorie deficit:** Aim for 1500-1800 kcal/day\n' : '- 🍽️ **Maintain:** 1800-2200 kcal/day\n') +
        (readings.hemoglobin && readings.hemoglobin.value < 13 ? '- 🥬 **Iron-rich foods:** Spinach, lentils, jaggery, pomegranate\n' : '') +
        (readings.ldl && readings.ldl.value > 100 ? '- 🐟 **Heart health:** Omega-3 (fish, walnuts, flaxseed), oats, olive oil\n' : '') +
        (readings.blood_sugar && readings.blood_sugar.value > 140 ? '- 🚫 **Avoid:** White rice, maida, sugary drinks, processed snacks\n' : '') +
        `- 💧 **Hydration:** 8-10 glasses of water daily\n` +
        `- 🥛 **Protein:** Include dal, paneer, eggs, or chicken in every meal\n` +
        `- 🌾 **Fiber:** Whole grains, fruits, vegetables (25-30g/day)\n`,
      type: 'recommendation',
    };
  }

  // Risk assessment
  if (msg.includes('risk') || msg.includes('danger') || msg.includes('worry') || msg.includes('concern')) {
    const risks = [];
    if (readings.bp_systolic && readings.bp_systolic.value >= 140) risks.push('High blood pressure (hypertension)');
    if (readings.blood_sugar && readings.blood_sugar.value > 200) risks.push('Elevated blood sugar');
    if (readings.ldl && readings.ldl.value > 160) risks.push('High LDL cholesterol');
    if (readings.bmi && readings.bmi.value > 30) risks.push('Obesity');
    if (readings.hemoglobin && readings.hemoglobin.value < 10) risks.push('Significant anemia');
    if (readings.visceral_fat && readings.visceral_fat.value > 12) risks.push('High visceral fat');

    return {
      response: risks.length > 0
        ? `**⚠️ Risk Areas Identified:**\n\n${risks.map(r => `- 🔴 ${r}`).join('\n')}\n\n**Recommendation:** Schedule a consultation with your healthcare provider to address these concerns.`
        : `**✅ No High-Risk Areas:**\n\nYour biomarkers are within acceptable ranges. Continue regular monitoring and maintain your healthy lifestyle.`,
      type: 'assessment',
    };
  }

  // General health summary
  if (msg.includes('summary') || msg.includes('overview') || msg.includes('health') || msg.includes('report')) {
    let normal = 0, borderline = 0, critical = 0;
    for (const [, r] of Object.entries(readings)) {
      if (r.status === 'normal') normal++;
      else if (r.status === 'critical') critical++;
      else borderline++;
    }
    const total = normal + borderline + critical;
    const score = Math.round((normal / total) * 100);

    return {
      response: `**Health Summary:**\n\n` +
        `🏥 Health Score: **${score}%**\n\n` +
        `| Status | Count |\n|---|---|\n| ✅ Normal | ${normal} |\n| ⚠️ Borderline | ${borderline} |\n| 🔴 Critical | ${critical} |\n\n` +
        `**Key Vitals:** BP ${readings.bp_systolic ? readings.bp_systolic.value + '/' + (readings.bp_diastolic ? readings.bp_diastolic.value : '?') : 'N/A'} | ` +
        `SpO2 ${readings.spo2 ? readings.spo2.value + '%' : 'N/A'} | ` +
        `Pulse ${readings.pulse ? readings.pulse.value + ' bpm' : 'N/A'} | ` +
        `BMI ${readings.bmi ? readings.bmi.value : 'N/A'}`,
      type: 'summary',
    };
  }

  // Default
  return {
    response: `I can help you understand your health reports. Try asking:\n\n` +
      `- "Explain my lipid profile"\n` +
      `- "How is my blood pressure?"\n` +
      `- "Am I at risk for anything?"\n` +
      `- "What should I eat?"\n` +
      `- "Give me a health summary"\n` +
      `- "How is my blood sugar?"`,
    type: 'help',
  };
}

// GET /api/health-ai/tips — Quick pro tips from latest results
router.get('/tips', (req, res) => {
  const userId = 'user-001';
  const latest = db.query('Readings', userId, { sortDesc: true, limit: 1 });
  if (!latest.length) return res.json({ success: true, tips: [] });

  const tips = generateTips(latest[0].readings);
  res.json({ success: true, tips, date: latest[0].date });
});

// POST /api/health-ai/chat — AI chatbot
router.post('/chat', (req, res) => {
  const userId = 'user-001';
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const latest = db.query('Readings', userId, { sortDesc: true, limit: 1 });
  if (!latest.length) {
    return res.json({ success: true, response: 'No biomarker data available. Please complete a health checkup first.', type: 'error' });
  }

  const result = generateChatResponse(message, latest[0].readings, BIOMARKER_DEFS);
  res.json({ success: true, ...result });
});

module.exports = router;
