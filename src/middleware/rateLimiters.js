const rateLimit = require('express-rate-limit');

function responderLimite(req, res) {
  res.status(429).json({
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
    },
  });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: responderLimite,
});

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
});

module.exports = { loginLimiter, registroLimiter };
