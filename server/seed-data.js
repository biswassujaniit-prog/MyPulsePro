// ============================================
// MyPulsePro — Biomarker Seed Data Generator
// ============================================
// 60+ biomarker parameters across 12 medical test categories
// Generates 6 months of realistic historical readings

const db = require('./aws-sim');

// ─── Reference Ranges ───────────────────────────────────────────
const BIOMARKER_DEFS = {
  // ── General Health (19 params) ──
  spo2: { name: 'SpO2', unit: '%', category: 'general', min: 88, max: 100, normalLow: 95, normalHigh: 100, criticalLow: 90, criticalHigh: 100, icon: 'lungs' },
  pulse: { name: 'Pulse Rate', unit: 'bpm', category: 'general', min: 40, max: 130, normalLow: 60, normalHigh: 100, criticalLow: 50, criticalHigh: 120, icon: 'heartbeat' },
  body_temp: { name: 'Body Temperature', unit: '°F', category: 'general', min: 95, max: 104, normalLow: 97.8, normalHigh: 99.1, criticalLow: 96, criticalHigh: 103, icon: 'thermometer' },
  height: { name: 'Height', unit: 'cm', category: 'general', min: 150, max: 190, normalLow: 155, normalHigh: 185, criticalLow: 140, criticalHigh: 200, icon: 'ruler' },
  weight: { name: 'Body Weight', unit: 'kg', category: 'general', min: 45, max: 120, normalLow: 55, normalHigh: 85, criticalLow: 40, criticalHigh: 130, icon: 'weight' },
  bmi: { name: 'BMI', unit: 'kg/m²', category: 'general', min: 14, max: 40, normalLow: 18.5, normalHigh: 24.9, criticalLow: 16, criticalHigh: 35, icon: 'scale' },
  bmr: { name: 'BMR', unit: 'kcal', category: 'general', min: 1000, max: 2500, normalLow: 1200, normalHigh: 2000, criticalLow: 900, criticalHigh: 2600, icon: 'fire' },
  body_water: { name: 'Body Water', unit: '%', category: 'general', min: 40, max: 70, normalLow: 50, normalHigh: 65, criticalLow: 45, criticalHigh: 70, icon: 'droplet' },
  skeleton_mass: { name: 'Skeleton Mass', unit: '%', category: 'general', min: 10, max: 20, normalLow: 12, normalHigh: 17, criticalLow: 10, criticalHigh: 20, icon: 'bone' },
  muscle_mass: { name: 'Muscle Mass', unit: '%', category: 'general', min: 25, max: 55, normalLow: 33, normalHigh: 45, criticalLow: 28, criticalHigh: 55, icon: 'muscle' },
  bone_mass: { name: 'Bone Mass', unit: 'kg', category: 'general', min: 1.5, max: 5, normalLow: 2.5, normalHigh: 4, criticalLow: 2, criticalHigh: 5, icon: 'bone' },
  protein: { name: 'Protein', unit: '%', category: 'general', min: 10, max: 25, normalLow: 15, normalHigh: 20, criticalLow: 12, criticalHigh: 22, icon: 'protein' },
  metabolic_age: { name: 'Metabolic Age', unit: 'yrs', category: 'general', min: 18, max: 70, normalLow: 25, normalHigh: 40, criticalLow: 18, criticalHigh: 60, icon: 'clock' },
  fat_free_weight: { name: 'Fat Free Weight', unit: 'kg', category: 'general', min: 30, max: 80, normalLow: 40, normalHigh: 65, criticalLow: 35, criticalHigh: 75, icon: 'body' },
  body_fat: { name: 'Body Fat', unit: '%', category: 'general', min: 5, max: 45, normalLow: 10, normalHigh: 25, criticalLow: 5, criticalHigh: 35, icon: 'fat' },
  subcutaneous_fat: { name: 'Subcutaneous Fat', unit: '%', category: 'general', min: 5, max: 35, normalLow: 8, normalHigh: 23, criticalLow: 5, criticalHigh: 30, icon: 'layers' },
  visceral_fat: { name: 'Visceral Fat', unit: 'level', category: 'general', min: 1, max: 20, normalLow: 1, normalHigh: 9, criticalLow: 1, criticalHigh: 15, icon: 'warning' },
  physique: { name: 'Physique Rating', unit: '/9', category: 'general', min: 1, max: 9, normalLow: 4, normalHigh: 7, criticalLow: 1, criticalHigh: 9, icon: 'star' },

  // ── Cardiac (7 params) ──
  bp_systolic: { name: 'BP (Systolic)', unit: 'mmHg', category: 'cardiac', min: 80, max: 200, normalLow: 90, normalHigh: 120, criticalLow: 80, criticalHigh: 180, icon: 'heart' },
  bp_diastolic: { name: 'BP (Diastolic)', unit: 'mmHg', category: 'cardiac', min: 50, max: 130, normalLow: 60, normalHigh: 80, criticalLow: 50, criticalHigh: 120, icon: 'heart' },
  total_cholesterol: { name: 'Total Cholesterol', unit: 'mg/dL', category: 'cardiac', min: 100, max: 350, normalLow: 125, normalHigh: 200, criticalLow: 100, criticalHigh: 300, icon: 'lipid' },
  triglycerides: { name: 'Triglycerides', unit: 'mg/dL', category: 'cardiac', min: 40, max: 500, normalLow: 50, normalHigh: 150, criticalLow: 40, criticalHigh: 400, icon: 'lipid' },
  hdl: { name: 'HDL Cholesterol', unit: 'mg/dL', category: 'cardiac', min: 20, max: 100, normalLow: 40, normalHigh: 60, criticalLow: 25, criticalHigh: 100, icon: 'shield' },
  ldl: { name: 'LDL Cholesterol', unit: 'mg/dL', category: 'cardiac', min: 40, max: 250, normalLow: 50, normalHigh: 100, criticalLow: 40, criticalHigh: 190, icon: 'alert' },
  tc_hdl_ratio: { name: 'TC/HDL Ratio', unit: '', category: 'cardiac', min: 1, max: 8, normalLow: 1, normalHigh: 4.5, criticalLow: 1, criticalHigh: 6, icon: 'ratio' },

  // ── Diabetes (2 params) ──
  blood_sugar: { name: 'Random Blood Sugar', unit: 'mg/dL', category: 'diabetes', min: 50, max: 400, normalLow: 70, normalHigh: 140, criticalLow: 60, criticalHigh: 300, icon: 'sugar' },
  hba1c: { name: 'HbA1c', unit: '%', category: 'diabetes', min: 3, max: 14, normalLow: 4, normalHigh: 5.7, criticalLow: 3, criticalHigh: 9, icon: 'glyco' },

  // ── Anemia (1 param) ──
  hemoglobin: { name: 'Hemoglobin', unit: 'g/dL', category: 'anemia', min: 6, max: 20, normalLow: 12, normalHigh: 17, criticalLow: 8, criticalHigh: 20, icon: 'blood' },

  // ── Rapid Tests (11 params — numeric ones) ──
  urobilinogen: { name: 'Urobilinogen', unit: 'mg/dL', category: 'rapid', min: 0, max: 12, normalLow: 0.1, normalHigh: 1.0, criticalLow: 0, criticalHigh: 8, icon: 'test' },
  microalbumin: { name: 'Microalbumin', unit: 'mg/L', category: 'rapid', min: 0, max: 300, normalLow: 0, normalHigh: 30, criticalLow: 0, criticalHigh: 200, icon: 'kidney' },
  urine_glucose: { name: 'Urine Glucose', unit: 'mg/dL', category: 'rapid', min: 0, max: 1000, normalLow: 0, normalHigh: 15, criticalLow: 0, criticalHigh: 500, icon: 'sugar' },
  blood_ph: { name: 'Blood pH', unit: '', category: 'rapid', min: 6.5, max: 8, normalLow: 7.35, normalHigh: 7.45, criticalLow: 7.0, criticalHigh: 7.8, icon: 'ph' },
  bilirubin: { name: 'Bilirubin', unit: 'mg/dL', category: 'rapid', min: 0, max: 6, normalLow: 0.1, normalHigh: 1.2, criticalLow: 0, criticalHigh: 5, icon: 'liver' },
  urine_protein: { name: 'Urine Protein', unit: 'mg/dL', category: 'rapid', min: 0, max: 300, normalLow: 0, normalHigh: 14, criticalLow: 0, criticalHigh: 200, icon: 'protein' },
  ketones: { name: 'Ketones', unit: 'mg/dL', category: 'rapid', min: 0, max: 80, normalLow: 0, normalHigh: 0.6, criticalLow: 0, criticalHigh: 40, icon: 'keto' },
  specific_gravity: { name: 'Specific Gravity', unit: '', category: 'rapid', min: 1.0, max: 1.035, normalLow: 1.005, normalHigh: 1.025, criticalLow: 1.0, criticalHigh: 1.035, icon: 'gravity' },
  leukocytes: { name: 'Leukocytes', unit: 'cells/µL', category: 'rapid', min: 0, max: 500, normalLow: 0, normalHigh: 10, criticalLow: 0, criticalHigh: 100, icon: 'cell' },

  // ── Pulmonary (4 params) ──
  fvc: { name: 'FVC', unit: 'L', category: 'pulmonary', min: 1.5, max: 6, normalLow: 3, normalHigh: 5, criticalLow: 2, criticalHigh: 6, icon: 'lungs' },
  fev1: { name: 'FEV1', unit: 'L', category: 'pulmonary', min: 1, max: 5, normalLow: 2.5, normalHigh: 4, criticalLow: 1.5, criticalHigh: 5, icon: 'lungs' },
  pef: { name: 'PEF', unit: 'L/min', category: 'pulmonary', min: 100, max: 700, normalLow: 300, normalHigh: 600, criticalLow: 200, criticalHigh: 700, icon: 'wind' },
  fev1_fvc: { name: 'FEV1/FVC Ratio', unit: '%', category: 'pulmonary', min: 50, max: 100, normalLow: 70, normalHigh: 85, criticalLow: 60, criticalHigh: 95, icon: 'ratio' },

  // ── Eye Test (2 params) ──
  vision_score: { name: 'Vision Acuity', unit: '/6', category: 'eye', min: 1, max: 6, normalLow: 5, normalHigh: 6, criticalLow: 2, criticalHigh: 6, icon: 'eye' },
  color_vision: { name: 'Color Vision', unit: '/14', category: 'eye', min: 0, max: 14, normalLow: 12, normalHigh: 14, criticalLow: 8, criticalHigh: 14, icon: 'palette' },

  // ── Mental Health (1 param) ──
  phq9: { name: 'Depression Score (PHQ-9)', unit: '/27', category: 'mental', min: 0, max: 27, normalLow: 0, normalHigh: 4, criticalLow: 0, criticalHigh: 20, icon: 'brain' },

  // ── Auscultation (2 params) ──
  heart_sound: { name: 'Heart Sound Score', unit: '/10', category: 'auscultation', min: 0, max: 10, normalLow: 7, normalHigh: 10, criticalLow: 3, criticalHigh: 10, icon: 'stethoscope' },
  lung_sound: { name: 'Lung Sound Score', unit: '/10', category: 'auscultation', min: 0, max: 10, normalLow: 7, normalHigh: 10, criticalLow: 3, criticalHigh: 10, icon: 'stethoscope' },
};

const CATEGORIES = {
  general: { name: 'General Health Checkup', description: 'Vitals, body composition, and metabolic indicators', icon: 'activity', color: '#00B4D8' },
  cardiac: { name: 'Cardiac Profile', description: 'Blood pressure, lipid profile, and heart health', icon: 'heart', color: '#E63946' },
  diabetes: { name: 'Diabetes Screening', description: 'Blood sugar and glycated hemoglobin', icon: 'droplet', color: '#F4A261' },
  anemia: { name: 'Anemia Test', description: 'Hemoglobin and iron status', icon: 'tint', color: '#E76F51' },
  rapid: { name: 'Rapid Panel Tests', description: 'Urine analysis and rapid screening markers', icon: 'zap', color: '#2A9D8F' },
  pulmonary: { name: 'Pulmonary Function', description: 'Lung capacity and airflow measurements', icon: 'wind', color: '#457B9D' },
  eye: { name: 'Eye Examination', description: 'Visual acuity and color vision assessment', icon: 'eye', color: '#6C63FF' },
  mental: { name: 'Mental Health', description: 'Depression and anxiety screening (PHQ-9)', icon: 'brain', color: '#9B5DE5' },
  auscultation: { name: 'Auscultation', description: 'Heart and lung sound assessment', icon: 'stethoscope', color: '#F72585' },
};

// ─── Generate realistic dummy readings ──────────────────────────
function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

function generateReading(def, dayOffset, baseValues) {
  // Create a value that trends around a "base" with daily variance
  const base = baseValues[def.name] || rand(def.normalLow, def.normalHigh);
  const variance = (def.normalHigh - def.normalLow) * 0.15;
  let val = base + rand(-variance, variance);
  // Occasional borderline / abnormal values (~20% of readings)
  if (Math.random() < 0.12) val = rand(def.criticalLow, def.normalLow);
  if (Math.random() < 0.08) val = rand(def.normalHigh, def.criticalHigh * 0.85);
  val = Math.max(def.min, Math.min(def.max, val));
  // Round integers for whole-number biomarkers
  if (['bpm', 'mmHg', 'mg/dL', 'cells/µL', 'kcal', 'yrs', '/27', '/10', '/9', '/14', '/6', 'L/min', 'cm'].includes(def.unit)) {
    val = Math.round(val);
  } else {
    val = Math.round(val * 10) / 10;
  }
  return val;
}

function getStatus(val, def) {
  if (val >= def.normalLow && val <= def.normalHigh) return 'normal';
  if (val < def.criticalLow || val > def.criticalHigh) return 'critical';
  return 'borderline';
}

// ─── Main Seed Function ─────────────────────────────────────────
function seedDatabase() {
  console.log('  [Seed] Generating biomarker data...');
  const userId = 'user-001';
  const now = new Date();

  // Store biomarker definitions
  for (const [key, def] of Object.entries(BIOMARKER_DEFS)) {
    db.putItem('BiomarkerDefs', {
      pk: 'DEF',
      sk: key,
      ...def,
    });
  }

  // Store category definitions
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    db.putItem('Categories', {
      pk: 'CAT',
      sk: key,
      ...cat,
      biomarkers: Object.entries(BIOMARKER_DEFS).filter(([, d]) => d.category === key).map(([k]) => k),
    });
  }

  // Generate 180 days of data (6 months)
  const baseValues = {};
  // Set base values for consistent trends
  for (const [key, def] of Object.entries(BIOMARKER_DEFS)) {
    baseValues[def.name] = rand(
      def.normalLow + (def.normalHigh - def.normalLow) * 0.1,
      def.normalHigh - (def.normalHigh - def.normalLow) * 0.1
    );
  }

  let recordCount = 0;
  for (let day = 180; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split('T')[0];

    const readings = {};
    for (const [key, def] of Object.entries(BIOMARKER_DEFS)) {
      const val = generateReading(def, day, baseValues);
      readings[key] = {
        value: val,
        status: getStatus(val, def),
        unit: def.unit,
      };
    }

    db.putItem('Readings', {
      pk: `${userId}`,
      sk: dateStr,
      date: dateStr,
      readings,
      timestamp: date.getTime(),
    });
    recordCount++;
  }

  // Generate sample diet logs (last 30 days)
  const MEAL_TEMPLATES = [
    { meal: 'breakfast', items: ['Oats with milk', 'Banana', 'Green tea'], calories: 320, protein: 12, carbs: 52, fat: 8, fiber: 6 },
    { meal: 'breakfast', items: ['Idli sambar', 'Coconut chutney', 'Coffee'], calories: 280, protein: 8, carbs: 48, fat: 6, fiber: 4 },
    { meal: 'breakfast', items: ['Poha', 'Sprouts', 'Juice'], calories: 310, protein: 10, carbs: 50, fat: 7, fiber: 5 },
    { meal: 'lunch', items: ['Rice', 'Dal', 'Sabzi', 'Curd'], calories: 520, protein: 18, carbs: 78, fat: 12, fiber: 8 },
    { meal: 'lunch', items: ['Roti', 'Paneer curry', 'Salad', 'Buttermilk'], calories: 480, protein: 22, carbs: 55, fat: 16, fiber: 6 },
    { meal: 'lunch', items: ['Chicken rice', 'Raita', 'Papad'], calories: 580, protein: 32, carbs: 62, fat: 18, fiber: 4 },
    { meal: 'dinner', items: ['Chapati', 'Mixed veg', 'Dal'], calories: 420, protein: 14, carbs: 58, fat: 10, fiber: 7 },
    { meal: 'dinner', items: ['Khichdi', 'Pickle', 'Papad'], calories: 380, protein: 12, carbs: 62, fat: 8, fiber: 5 },
    { meal: 'snack', items: ['Almonds', 'Apple'], calories: 180, protein: 6, carbs: 22, fat: 10, fiber: 4 },
    { meal: 'snack', items: ['Protein shake', 'Peanuts'], calories: 250, protein: 20, carbs: 18, fat: 12, fiber: 3 },
  ];

  for (let day = 30; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split('T')[0];

    const meals = [];
    // Pick 3-4 meals per day (breakfast, lunch, dinner, maybe snack)
    const bIdx = randInt(0, 2);
    const lIdx = randInt(3, 5);
    const dIdx = randInt(6, 7);
    meals.push(MEAL_TEMPLATES[bIdx], MEAL_TEMPLATES[lIdx], MEAL_TEMPLATES[dIdx]);
    if (Math.random() > 0.4) meals.push(MEAL_TEMPLATES[randInt(8, 9)]);

    const totals = meals.reduce((acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
      fiber: acc.fiber + m.fiber,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

    db.putItem('DietLogs', {
      pk: userId,
      sk: dateStr,
      date: dateStr,
      meals,
      totals,
    });
  }

  // Recommended diet plan
  db.putItem('DietPlans', {
    pk: userId,
    sk: 'recommended',
    name: 'Balanced Health Plan',
    dailyTargets: { calories: 1800, protein: 60, carbs: 220, fat: 50, fiber: 25 },
    restrictions: ['Low sodium', 'Moderate sugar'],
    meals: [
      { meal: 'breakfast', suggestion: 'Oats/Idli/Poha with fruits', targetCalories: 350 },
      { meal: 'lunch', suggestion: 'Balanced plate: 50% veggies, 25% protein, 25% grains', targetCalories: 550 },
      { meal: 'snack', suggestion: 'Nuts, fruits, or protein shake', targetCalories: 200 },
      { meal: 'dinner', suggestion: 'Light meal: Soup, salad, or khichdi', targetCalories: 450 },
    ],
  });

  // Generate sample activity logs (last 30 days)
  const EXERCISE_TYPES = ['Running', 'Walking', 'Cycling', 'Swimming', 'Yoga', 'HIIT', 'Weightlifting'];
  
  for (let day = 30; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split('T')[0];

    // 70% chance to exercise on any given day
    if (Math.random() < 0.7) {
      const type = EXERCISE_TYPES[randInt(0, EXERCISE_TYPES.length - 1)];
      const duration = randInt(20, 90); // 20 to 90 mins
      const intensity = duration > 45 ? (Math.random() > 0.5 ? 'High' : 'Medium') : 'Low';
      
      const intensityMultiplier = intensity === 'High' ? 10 : intensity === 'Medium' ? 7 : 4;
      const calories = Math.round(duration * intensityMultiplier);
      const steps = ['Running', 'Walking'].includes(type) 
                    ? Math.round(duration * (intensity === 'High' ? 160 : 100)) 
                    : randInt(1000, 3000); // Base incidental steps

      db.putItem('ActivityLogs', {
        pk: userId,
        sk: `${dateStr}-sim-${randInt(1000, 9999)}`,
        date: dateStr,
        type,
        duration,
        intensity,
        calories,
        steps,
        source: 'Simulated'
      });
    } else {
      // Just basic daily movement (sedentary day)
      db.putItem('ActivityLogs', {
        pk: userId,
        sk: `${dateStr}-sim-${randInt(1000, 9999)}`,
        date: dateStr,
        type: 'Daily Movement',
        duration: randInt(5, 15),
        intensity: 'Low',
        calories: randInt(50, 150),
        steps: randInt(800, 2500),
        source: 'Simulated'
      });
    }
  }

  // Connect a mock wearable device by default
  db.putItem('WearableDevices', {
    pk: userId,
    sk: 'Apple Health',
    provider: 'Apple Health',
    connected: true,
    lastSync: now.toISOString()
  });

  console.log(`  [Seed] Created ${recordCount} daily readings (180 days)`);
  console.log(`  [Seed] Created 31 diet logs + recommended plan`);
  console.log(`  [Seed] Created 31 activity logs + mock wearable`);
  console.log(`  [Seed] ${Object.keys(BIOMARKER_DEFS).length} biomarker definitions stored`);
  console.log(`  [Seed] ${Object.keys(CATEGORIES).length} categories stored`);
  console.log('  [Seed] Done!');
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, BIOMARKER_DEFS, CATEGORIES };
