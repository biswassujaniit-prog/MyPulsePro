const crypto = require('crypto');

function parsePrescriptionText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 3);
  const exMeds = [];
  
  const dosageRegex = /(\d+(?:\.\d+)?\s*(mg|ml|mcg|g|iu|ui|tablet|tab|cap|capsule)s?)/i;
  const freqMap = [
    { key: /OD|once a day|daily|morning/i, label: "OD", times: ["08:00"] },
    { key: /BD|BID|twice a day/i, label: "BD", times: ["08:00", "20:00"] },
    { key: /TDS|TID|thrice a day/i, label: "TDS", times: ["08:00", "14:00", "20:00"] },
    { key: /night|bedtime|HS/i, label: "Nightly", times: ["22:00"] }
  ];

  lines.forEach(line => {
    const doseMatch = line.match(dosageRegex);
    if (doseMatch) {
      const nameRaw = line.substring(0, doseMatch.index).trim();
      const medName = nameRaw.replace(/[^a-zA-Z0-9\-\s]/g, '').trim() || "Unknown Medication";
      const dosage = doseMatch[1].trim();
      
      let assignedFreq = freqMap[0]; // Default OD
      for (const f of freqMap) {
        if (f.key.test(line)) {
          assignedFreq = f; break;
        }
      }

      exMeds.push({
        name: medName,
        dosage: dosage,
        frequency: assignedFreq.label,
        times: assignedFreq.times
      });
    }
  });

  return exMeds;
}

// Test cases
const tests = [
  "Metformin 500mg BD",
  "Take Panadol 2 tablets thrice a day",
  "Amoxicillin 250 mg once a day",
  "Vitamin D3 1000iu morning",
  "Paracetamol 500mg TDS"
];

for(const t of tests) {
  console.log(`Input: "${t}" -> Output:`, parsePrescriptionText(t));
}
