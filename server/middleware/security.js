// ============================================
// MyPulsePro — Security Middleware
// ============================================
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

function setupSecurity(app) {
  // Helmet for security headers (relaxed CSP for inline scripts/styles)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  }));

  // CORS
  app.use(cors({ origin: true, credentials: true }));

  // Rate limiting
  app.use('/api/', rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    message: { error: 'Too many requests. Please try again later.' },
  }));

  // Stricter limit for AI chat
  app.use('/api/health-ai/chat', rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'AI chat rate limit reached. Please wait a moment.' },
  }));
}

module.exports = setupSecurity;
