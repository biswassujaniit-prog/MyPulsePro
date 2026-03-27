/**
 * Medication Alert Engine
 * Phase 10: Dual Notification System
 */
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/medications.json');

// Memory state for WebSocket clients (Future SSE support if needed)
global.activeMedAlerts = []; 

async function startEngine() {
  console.log('[AlertEngine] Booting up Caregiver Notification Node...');
  
  // 1. Setup Free Automated SMTP
  let testAccount = await nodemailer.createTestAccount(); // 100% Free production-grade SMTP sandbox for testing
  let transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: { user: testAccount.user, pass: testAccount.pass },
  });

  console.log(`[AlertEngine] SMTP Transporter secured -> ${testAccount.user}`);

  // 2. Cron Job Tracker (Runs every 1 minute)
  cron.schedule('* * * * *', async () => {
    if (!fs.existsSync(dataPath)) return;
    
    let db = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const now = new Date();
    const currentHourMin = now.toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric" }); // "14:05"
    let dbModified = false;

    // Reset loop at midnight
    if (currentHourMin === "00:00") {
       db.prescriptions.forEach(m => { m.takenToday = false; m.lastAlertSent = null; });
       dbModified = true;
       console.log('[AlertEngine] Midnight Reset executed.');
    }

    // Scan all active prescriptions
    for (let med of db.prescriptions) {
      if (med.takenToday) continue; // Already taken

      for (let scheduledTime of med.times) {
        // If the current time is exactly the scheduled time, trigger the frontend Gamified neon popup!
        if (scheduledTime === currentHourMin) {
           console.log(`[AlertEngine] LIVE PATIENT REMINDER: Time to take ${med.name} (${med.dosage}) at ${scheduledTime}!`);
           global.activeMedAlerts.push({ id: med.id, msg: `Time to take ${med.name} (${med.dosage})!` });
        }

        // Caregiver Escalation Protocol (e.g., 60 minutes past dose time)
        // For demonstration, we trigger an email instantly if it's 2 mins past
        let [sHour, sMin] = scheduledTime.split(':').map(Number);
        let doseTime = new Date(); doseTime.setHours(sHour, sMin, 0, 0);
        let diffMins = (now - doseTime) / 60000;

        if (diffMins > 2 && diffMins < 60 && med.lastAlertSent !== scheduledTime) {
          console.log(`[AlertEngine] CAREGIVER ESCALATION: Patient missed ${med.name}. Dispatching SMTP Email...`);
          med.lastAlertSent = scheduledTime;
          dbModified = true;

          try {
            let info = await transporter.sendMail({
              from: '"MyPulsePro System" <system@mypulsepro.com>',
              to: db.caregiverEmail || "caregiver@test.com",
              subject: `🚨 Missed Medication Alert: ${med.name}`,
              text: `URGENT CAREGIVER ALERT:\n\nThe patient has not logged their scheduled dose of ${med.name} (${med.dosage}) which was due at ${scheduledTime}.\n\nPlease check on them.\n\n- MyPulsePro Automated tracking.`,
            });
            console.log("[AlertEngine] Notification dispatched successfully. URL: %s", nodemailer.getTestMessageUrl(info));
          } catch (e) {
            console.error("[AlertEngine] SMTP Failure:", e.message);
          }
        }
      }
    }

    if (dbModified) {
      fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
    }
  });
}

// Instantiate engine asynchronously
startEngine().catch(console.error);

module.exports = { startEngine };
