'use strict';

// Neon serverless Postgres client wrapper.
// Each call to sql() returns the singleton tagged-template client. The
// Neon HTTP driver is designed for Vercel Functions — every invocation
// gets a cheap connection, no pool to exhaust.

const { neon } = require('@neondatabase/serverless');

let _client = null;

function getSql() {
  if (_client) return _client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _client = neon(url);
  return _client;
}

module.exports = { getSql };
