// ============================================
// MyPulsePro — Health AI Routes
// ============================================
const express = require('express');
const router = express.Router();
const db = require('../aws-sim');
const { BIOMARKER_DEFS } = require('../seed-data');

// ─── Rule-based Health AI Engine ────────────────────────────────
function generateTips(readings) {
  const tips = [];

  if (readings.bp_systolic && readings.bp_systolic.status !== 'normal') {
    tips.push({
      category: 'Cardiac', severity: readings.bp_systolic.status,
      tip: `Your blood pressure is ${readings.bp_systolic.value}/${readings.bp_diastolic ? readings.bp_diastolic.value : '?'} mmHg (${readings.bp_systolic.status}). ${readings.bp_systolic.value > 130 ? 'Reduce sodium intake, manage stress, and consider consulting a cardiologist.' : 'Monitor regularly and maintain a balanced diet.'}`,
    });
  }

  if (readings.blood_sugar && readings.blood_sugar.status !== 'normal') {
    tips.push({
      category: 'Diabetes', severity: readings.blood_sugar.status,
      tip: `Random blood sugar is ${readings.blood_sugar.value} mg/dL (${readings.blood_sugar.status}). ${readings.blood_sugar.value > 200 ? 'This is elevated. Avoid refined sugars, increase fiber, and consult your physician.' : 'Moderate carb intake and stay physically active.'}`,
    });
  }

  if (readings.hba1c && readings.hba1c.value > 5.7) {
    tips.push({
      category: 'Diabetes', severity: readings.hba1c.value > 6.5 ? 'critical' : 'borderline',
      tip: `HbA1c is ${readings.hba1c.value}% — ${readings.hba1c.value > 6.5 ? 'indicates diabetes. Please consult an endocrinologist immediately.' : 'indicates pre-diabetes. Lifestyle modifications recommended: regular exercise, reduced sugar intake.'}`,
    });
  }

  if (readings.bmi && readings.bmi.status !== 'normal') {
    const bv = readings.bmi.value;
    tips.push({
      category: 'General', severity: readings.bmi.status,
      tip: `BMI is ${bv} kg/m² (${bv < 18.5 ? 'underweight' : bv > 30 ? 'obese' : 'overweight'}). ${bv < 18.5 ? 'Focus on nutrient-dense foods and healthy calorie surplus.' : 'Aim for 150 min/week of moderate exercise and portion control.'}`,
    });
  }

  if (readings.hemoglobin && readings.hemoglobin.status !== 'normal') {
    tips.push({
      category: 'Anemia', severity: readings.hemoglobin.status,
      tip: `Hemoglobin is ${readings.hemoglobin.value} g/dL (${readings.hemoglobin.status}). ${readings.hemoglobin.value < 10 ? 'This is low. Include iron-rich foods (spinach, lentils, pomegranate) and consider iron supplements.' : 'Maintain iron-rich diet and Vitamin C for absorption.'}`,
    });
  }

  if (readings.total_cholesterol && readings.total_cholesterol.value > 200) {
    tips.push({
      category: 'Cardiac', severity: readings.total_cholesterol.value > 240 ? 'critical' : 'borderline',
      tip: `Total cholesterol is ${readings.total_cholesterol.value} mg/dL. Reduce saturated fats, increase omega-3 (fish, flaxseed), and exercise regularly.`,
    });
  }

  if (readings.ldl && readings.ldl.value > 100) {
    tips.push({
      category: 'Cardiac', severity: readings.ldl.value > 160 ? 'critical' : 'borderline',
      tip: `LDL ("bad" cholesterol) is ${readings.ldl.value} mg/dL. Limit fried foods, increase soluble fiber (oats, beans), and consider statins if persistently high.`,
    });
  }

  if (readings.spo2 && readings.spo2.value < 95) {
    tips.push({
      category: 'Pulmonary', severity: readings.spo2.value < 90 ? 'critical' : 'borderline',
      tip: `SpO2 is ${readings.spo2.value}% (${readings.spo2.value < 90 ? 'dangerously low — seek medical attention immediately' : 'below optimal — practice breathing exercises and monitor regularly'}).`,
    });
  }

  if (readings.phq9 && readings.phq9.value > 4) {
    tips.push({
      category: 'Mental Health', severity: readings.phq9.value > 14 ? 'critical' : 'borderline',
      tip: `PHQ-9 score is ${readings.phq9.value}/27 — ${readings.phq9.value > 14 ? 'indicates moderately severe depression. Please reach out to a mental health professional.' : 'indicates mild-moderate symptoms. Consider regular exercise, mindfulness, and social connection.'}`,
    });
  }

  if (readings.visceral_fat && readings.visceral_fat.value > 9) {
    tips.push({
      category: 'General', severity: readings.visceral_fat.value > 14 ? 'critical' : 'borderline',
      tip: `Visceral fat level is ${readings.visceral_fat.value} (${readings.visceral_fat.value > 14 ? 'high risk' : 'above normal'}). Focus on reducing belly fat through HIIT exercises, reducing alcohol, and stress management.`,
    });
  }

  // If everything is normal
  if (tips.length === 0) {
    tips.push({
      category: 'General', severity: 'normal',
      tip: 'All biomarkers are within normal range. Keep up the healthy lifestyle! Regular checkups recommended every 3-6 months.',
    });
  }

  return tips;
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
