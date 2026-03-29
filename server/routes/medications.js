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

// Ensure directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const dataDir = path.join(__dirname, '../data');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Setup Multer for secure memory/temp file processing
const upload = multer({ dest: uploadsDir });
const dataPath = path.join(dataDir, 'medications.json');

// Helper: Read/Write DB
function getDB() {
  if (!fs.existsSync(dataPath)) return { prescriptions: [], caregiverEmail: "" };
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}
function saveDB(data) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// ─── Free NLP Heuristic Engine (v2 — Broadened Patterns) ──────
function parsePrescriptionText(rawText) {
  console.log('[OCR-NLP] Raw text length:', rawText.length);
  console.log('[OCR-NLP] Raw text:', rawText.substring(0, 500));
  
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const exMeds = [];
  
  // Broadened Regex — catches Indian prescription patterns like "Tab. Metformin 500 mg"
  const dosageRegex = /(\d+(?:[\.,]\d+)?\s*(?:mg|ml|mcg|µg|g|iu|ui|units?|tablet|tab|caps?|capsule|cc|drops?)s?)/i;
  // Also match lines with known medicine keywords even without dosage
  const medKeywords = /\b(tab\.?|cap\.?|inj\.?|syrup|susp\.?|cream|oint|drops|gel|spray|nebul|sachet)\b/i;
  // Indian frequency patterns: "1-0-1", "0-1-0", "1-1-1"
  const indianFreqRegex = /(\d)\s*[-–]\s*(\d)\s*[-–]\s*(\d)/;
  
  const freqMap = [
    { key: /\bOD\b|once\s*a\s*day|daily|\bmorning\b|\b1\s*[-–]\s*0\s*[-–]\s*0\b/i, label: "OD (Morning)", times: ["08:00"] },
    { key: /\bBD\b|\bBID\b|twice\s*a\s*day|\b1\s*[-–]\s*0\s*[-–]\s*1\b/i, label: "BD", times: ["08:00", "20:00"] },
    { key: /\bTDS\b|\bTID\b|thrice\s*a\s*day|\b1\s*[-–]\s*1\s*[-–]\s*1\b/i, label: "TDS", times: ["08:00", "14:00", "20:00"] },
    { key: /\bnight\b|\bbedtime\b|\bHS\b|\b0\s*[-–]\s*0\s*[-–]\s*1\b/i, label: "Nightly", times: ["22:00"] },
    { key: /\bafter\s*food\b|\bwith\s*food\b|\bAF\b/i, label: "With Food", times: ["09:00"] },
  ];

  lines.forEach((line, idx) => {
    const doseMatch = line.match(dosageRegex);
    const medMatch = line.match(medKeywords);
    
    if (doseMatch || medMatch) {
      // Extract name: everything before the dosage number or med keyword
      let medName = 'Unknown Medication';
      let dosage = '1 Dose';
      
      if (doseMatch) {
        const nameRaw = line.substring(0, doseMatch.index).trim();
        medName = nameRaw.replace(/^(tab\.?|cap\.?|inj\.?|syrup|\d+\.?\s*)/i, '').replace(/[^a-zA-Z0-9\-\s]/g, '').trim() || 'Unknown Medication';
        dosage = doseMatch[1].trim();
      } else if (medMatch) {
        // Line has med keyword but no dose — extract name after keyword
        const afterKeyword = line.substring(medMatch.index + medMatch[0].length).trim();
        medName = afterKeyword.replace(/[^a-zA-Z0-9\-\s]/g, '').trim().split(/\s+/).slice(0, 3).join(' ') || 'Unknown Medication';
      }
      
      // Determine Frequency mapping — check Indian format first
      let assignedFreq = freqMap[0]; // Default OD
      const indianMatch = line.match(indianFreqRegex);
      if (indianMatch) {
        const sum = parseInt(indianMatch[1]) + parseInt(indianMatch[2]) + parseInt(indianMatch[3]);
        if (sum === 1) assignedFreq = indianMatch[3] === '1' ? freqMap[3] : freqMap[0];
        else if (sum === 2) assignedFreq = freqMap[1];
        else if (sum >= 3) assignedFreq = freqMap[2];
      } else {
        for (const f of freqMap) {
          if (f.key.test(line)) { assignedFreq = f; break; }
        }
      }

      // Avoid duplicates
      if (medName.length > 1 && !exMeds.find(m => m.name === medName)) {
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
    }
  });

  // Fallback if OCR was too garbled — still return something actionable
  if (exMeds.length === 0) {
    // Try to salvage any word that looks medical from the full text
    const wordFallback = rawText.match(/[A-Z][a-z]{3,}/g);
    exMeds.push({
      id: crypto.randomBytes(6).toString('hex'),
      name: wordFallback ? wordFallback.slice(0, 2).join(' ') + ' (Review)' : 'Unrecognized Prescription (Review Needed)',
      dosage: '1 Dose',
      frequency: 'OD',
      times: ['08:00'],
      takenToday: false,
      lastTakenAt: null
    });
  }

  console.log('[OCR-NLP] Extracted', exMeds.length, 'medications');
  return exMeds;
}

// ─── API Routes ───────────────────────────────────────────────

router.get('/', (req, res) => {
  const db = getDB();
  res.json({ success: true, data: db.prescriptions });
});

router.post('/upload', upload.single('prescription'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  
  console.log('[MED-UPLOAD] File received:', req.file.originalname, req.file.size, 'bytes');
  
  try {
    // 1. OCR Extraction using Tesseract (Free/No API key)
    console.log('[MED-UPLOAD] Starting Tesseract OCR on:', req.file.path);
    const result = await Tesseract.recognize(req.file.path, 'eng', {
      logger: m => { if (m.status === 'recognizing text') console.log('[Tesseract]', Math.round(m.progress * 100) + '%'); }
    });
    const text = result.data.text;
    console.log('[MED-UPLOAD] OCR completed. Text length:', text.length);
    console.log('[MED-UPLOAD] OCR text preview:', text.substring(0, 300));
    
    // 2. Pass text through our local NLP Heuristic Engine
    const newMeds = parsePrescriptionText(text);
    
    // 3. Save to DB
    const db = getDB();
    db.prescriptions = [...db.prescriptions, ...newMeds];
    saveDB(db);

    // Clean up temp file
    try { fs.unlinkSync(req.file.path); } catch(e) {}

    res.json({ success: true, message: 'Prescription parsed successfully', added: newMeds, ocrText: text });
  } catch (error) {
    console.error('[MED-UPLOAD] OCR Error:', error.message, error.stack);
    try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.status(500).json({ success: false, message: 'OCR Engine failed: ' + error.message });
  }
});

// Manual medication entry (OCR fallback)
router.post('/manual', (req, res) => {
  const { name, dosage, frequency, times } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Medicine name required' });
  
  const db = getDB();
  const newMed = {
    id: crypto.randomBytes(6).toString('hex'),
    name,
    dosage: dosage || '1 Dose',
    frequency: frequency || 'OD',
    times: times || ['08:00'],
    takenToday: false,
    lastTakenAt: null
  };
  db.prescriptions.push(newMed);
  saveDB(db);
  res.json({ success: true, message: 'Medication added', added: [newMed] });
});

// Delete a medication
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prescriptions = db.prescriptions.filter(m => m.id !== req.params.id);
  saveDB(db);
  res.json({ success: true, message: 'Medication removed' });
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
