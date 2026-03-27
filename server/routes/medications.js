/**
 * Medicine & Prescriptions Router
 * Phase 10: Tesseract OCR + Sandbox Heuristic Parsing
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const crypto = require('crypto');

// Setup Multer for secure memory/temp file processing
const upload = multer({ dest: path.join(__dirname, '../uploads/') });
const dataPath = path.join(__dirname, '../data/medications.json');

// Helper: Read/Write DB
function getDB() {
  if (!fs.existsSync(dataPath)) return { prescriptions: [], caregiverEmail: "" };
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}
function saveDB(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// ─── Free NLP Heuristic Engine ────────────────────────────────
function parsePrescriptionText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 3);
  const exMeds = [];
  
  // Regex Dictionary for free extraction
  const dosageRegex = /(\d+(?:\.\d+)?\s*(mg|ml|mcg|g|iu|ui|tablet|tab|cap|capsule)s?)/i;
  const freqMap = [
    { key: /OD|once a day|daily|morning/i, label: "OD", times: ["08:00"] },
    { key: /BD|BID|twice a day/i, label: "BD", times: ["08:00", "20:00"] },
    { key: /TDS|TID|thrice a day/i, label: "TDS", times: ["08:00", "14:00", "20:00"] },
    { key: /night|bedtime|HS/i, label: "Nightly", times: ["22:00"] }
  ];

  lines.forEach(line => {
    // Only parse lines that look like medications (contain mg, ml, tab, etc)
    const doseMatch = line.match(dosageRegex);
    if (doseMatch) {
      // Clean name: everything before the dosage
      const nameRaw = line.substring(0, doseMatch.index).trim();
      const medName = nameRaw.replace(/[^a-zA-Z0-9\-\s]/g, '').trim() || "Unknown Medication";
      const dosage = doseMatch[1].trim();
      
      // Determine Frequency mapping
      let assignedFreq = freqMap[0]; // Default OD
      for (const f of freqMap) {
        if (f.key.test(line)) {
          assignedFreq = f; break;
        }
      }

      exMeds.push({
        id: crypto.randomBytes(6).toString('hex'),
        name: medName,
        dosage: dosage,
        frequency: assignedFreq.label,
        times: assignedFreq.times,
        takenToday: false,
        lastTakenAt: null
      });
    }
  });

  // Fallback if OCR was too garbled
  if (exMeds.length === 0) {
    exMeds.push({
      id: crypto.randomBytes(6).toString('hex'),
      name: "Parsed Medicine (Review Needed)",
      dosage: "1 Dose",
      frequency: "OD",
      times: ["08:00"],
      takenToday: false,
      lastTakenAt: null
    });
  }

  return exMeds;
}

// ─── API Routes ───────────────────────────────────────────────

router.get('/', (req, res) => {
  const db = getDB();
  res.json({ success: true, data: db.prescriptions });
});

router.post('/upload', upload.single('prescription'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  
  try {
    // 1. OCR Extraction using Tesseract (Free/No API key)
    const result = await Tesseract.recognize(req.file.path, 'eng');
    const text = result.data.text;
    
    // 2. Pass text through our local NLP Heuristic Engine
    const newMeds = parsePrescriptionText(text);
    
    // 3. Save to DB
    const db = getDB();
    db.prescriptions = [...db.prescriptions, ...newMeds];
    saveDB(db);

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, message: 'Prescription parsed successfully', added: newMeds });
  } catch (error) {
    console.error("OCR Error:", error);
    res.status(500).json({ success: false, message: 'OCR Engine failed' });
  }
});

router.post('/log', (req, res) => {
  const id = req.body.id;
  const db = getDB();
  const med = db.prescriptions.find(m => m.id === id);
  if (med) {
    med.takenToday = true;
    med.lastTakenAt = new Date().toISOString();
    saveDB(db);
    res.json({ success: true, message: 'Dosage logged' });
  } else {
    res.status(404).json({ success: false, message: 'Medication not found' });
  }
});

module.exports = router;
