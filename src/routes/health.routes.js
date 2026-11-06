const { Router } = require('express');
const { estadoDB } = require('../config/db');
const { estadoMySQL } = require('../config/mysql');

const router = Router();

/**
 * GET /api/health
 * Comprueba MongoDB y MySQL cuando este ultimo esta habilitado.
 * Devuelve 200 si la base esta conectada y 503 si no lo esta.
 */
router.get('/', (req, res) => {
  const database = estadoDB();
  const mysql = estadoMySQL();
  const mongoConectada = database.status === 'connected';
  const mysqlCorrecto = !mysql.enabled || mysql.status === 'connected';
  const conectada = mongoConectada && mysqlCorrecto;

  res.status(conectada ? 200 : 503).json({
    ok: conectada,
    data: {
      status: conectada ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: { mongodb: database, mysql },
    },
  });
});

module.exports = router;
