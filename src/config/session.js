const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo').default;

const { env } = require('./env');

function crearSessionStore() {
  const client = mongoose.connection.getClient();

  if (!client) {
    throw new Error('No se puede crear el almacen de sesiones sin una conexion a MongoDB.');
  }

  return MongoStore.create({
    client,
    collectionName: 'sessions',
    ttl: Math.ceil(env.sessionMaxAgeMs / 1000),
    autoRemove: 'native',
    stringify: false,
  });
}

function crearSessionMiddleware(store) {
  return session({
    name: env.sessionName,
    secret: env.sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: env.sessionMaxAgeMs,
    },
  });
}

module.exports = { crearSessionStore, crearSessionMiddleware };
