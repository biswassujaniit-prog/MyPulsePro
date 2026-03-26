const express = require('express');
const router = express.Router();

// Mock standard JWT-style login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Hardcoded check for the global dashboard user
  if ((username === 'test_user' || username === 'test_user@gmail.com') && password === 'password') {
    return res.json({ 
      success: true, 
      token: 'jwt_mock_test_user_7b82x9', 
      username: 'test_user' 
    });
  }

  // Reject invalid credentials to force standard login behavior
  return res.status(401).json({ 
    success: false, 
    message: 'Invalid credentials. Please use test_user / password for the demo.' 
  });
});

// Mock registration that auto-logs in the user
router.post('/register', (req, res) => {
  const { username, password, email, mobile } = req.body;
  
  // Simulate DB Creation delay
  setTimeout(() => {
    return res.json({ 
      success: true, 
      token: `jwt_mock_new_${Date.now()}`, 
      username: username || 'new_user' 
    });
  }, 500); 
});

module.exports = router;
