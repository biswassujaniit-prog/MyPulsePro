const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// In-memory OTP store (Username/Identifier -> { code, expires })
const otpStore = new Map();

/**
 * Multi-factor OTP Service
 * Handles real Email OTP via Nodemailer and simulated SMS OTP for Mobile.
 */
class OTPService {
  constructor() {
    this.emailTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email', // Replace with real Gmail/SMTP for production
      port: 587,
      auth: {
        user: 'reba.weber35@ethereal.email',
        pass: '6n9H6U9D4996924979'
      }
    });
  }

  /**
   * Generates and Sends OTP to the specified identifier (email or mobile)
   * @param {string} identifier 
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async sendOTP(identifier) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    otpStore.set(identifier, { code: otp, expires });

    const isEmail = identifier.includes('@');

    if (isEmail) {
      try {
        await this.emailTransporter.sendMail({
          from: '"MyPulsePro Auth" <auth@mypulsepro.com>',
          to: identifier,
          subject: "Your Health OTP Code",
          text: `Your One-Time Password is: ${otp}. It expires in 10 minutes.`,
          html: `<div style="font-family: sans-serif; padding: 20px; background: #0F172A; color: white; border-radius: 12px;">
                  <h2 style="color: #00F0FF;">MyPulsePro Security</h2>
                  <p>Your verification code is:</p>
                  <h1 style="letter-spacing: 5px; color: white;">${otp}</h1>
                  <p style="color: #94A3B8; font-size: 0.8rem;">This code will expire in 10 minutes.</p>
                </div>`
        });
        console.log(`[OTP] Email sent to ${identifier}: ${otp}`);
        return { success: true, message: `OTP sent to email: ${identifier}` };
      } catch (err) {
        console.error('[OTP] Error sending email:', err.message);
        return { success: false, message: 'Failed to send Email OTP.' };
      }
    } else {
      // simulated SMS OTP Logic
      console.log(`\n  [SMS OTP SIMULATION] ──────────────────────────`);
      console.log(`  To: ${identifier}`);
      console.log(`  Message: Your MyPulsePro code is ${otp}.`);
      console.log(`  ──────────────────────────────────────────────\n`);
      return { success: true, message: `OTP sent to mobile: ${identifier}` };
    }
  }

  /**
   * Verifies the OTP provided by the user
   * @param {string} identifier 
   * @param {string} code 
   * @returns {boolean}
   */
  verifyOTP(identifier, code) {
    const stored = otpStore.get(identifier);
    if (!stored) return false;
    if (Date.now() > stored.expires) {
      otpStore.delete(identifier);
      return false;
    }
    const isValid = stored.code === code;
    if (isValid) otpStore.delete(identifier); // Clear once used
    return isValid;
  }
}

module.exports = new OTPService();
