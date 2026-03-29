const express = require('express');
const router = express.Router();
const otpService = require('../services/otpService');

// In-memory sessions (Username/Identifier -> JWT-Mock-Token)
const sessionStore = new Map();

/**
 * Step 1: Request OTP
 * Sends a 6-digit code to the user's identifier (email or mobile) 
 */
router.post('/otp/send', async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ success: false, message: 'Identifier is required.' });

  // Whitelist test_user to skip REAL sending if you want, but the user asked for REAL OTP
  // For production feel, we'll send it even for test_user!
  const result = await otpService.sendOTP(identifier);
  
  if (result.success) {
    return res.json({ success: true, message: result.message });
  } else {
    return res.status(500).json({ success: false, message: result.message });
  }
});

/**
 * Step 2: Verify OTP
 * Checks code and returns authentication token if valid
 */
router.post('/otp/verify', (req, res) => {
  const { identifier, otp } = req.body;
  
  if (!identifier || !otp) {
    return res.status(400).json({ success: false, message: 'Identifier and OTP are required.' });
  }

  // Verify OTP
  const isValid = otpService.verifyOTP(identifier, otp);
  
  if (isValid) {
    const token = `jwt_otp_${Date.now()}_${identifier.substring(0,3)}`;
    return res.json({ 
      success: true, 
      token: token,
      username: identifier.includes('@') ? identifier.split('@')[0] : identifier
    });
  } else {
    return res.status(401).json({ success: false, message: 'Invalid or expired OTP code.' });
  }
});

// Mock registration (kept for compatibility)
router.post('/register', (req, res) => {
  const { username, password, email, mobile } = req.body;
  setTimeout(() => {
    return res.json({ success: true, token: `jwt_mock_new_${Date.now()}`, username: username || 'new_user' });
  }, 500); 
});

module.exports = router;
