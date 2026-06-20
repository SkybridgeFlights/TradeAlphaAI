'use strict';

// Clerk session token verification helper.
// Every API route under /api/account/* calls requireAccount(req) FIRST.
// Returns the verified account_id (Clerk user sub claim) or throws.
// Routes catch the throw and respond 401.

const { verifyToken } = require('@clerk/backend');

async function requireAccount(req) {
  const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(auth);
  if (!bearer) {
    const err = new Error('missing Authorization Bearer token');
    err.status = 401;
    throw err;
  }
  const token = bearer[1];
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    const err = new Error('server not configured (CLERK_SECRET_KEY missing)');
    err.status = 500;
    throw err;
  }
  let claims;
  try {
    claims = await verifyToken(token, { secretKey: secret });
  } catch (e) {
    const err = new Error('invalid or expired session token');
    err.status = 401;
    err.detail = String(e && e.message || e);
    throw err;
  }
  const accountId = claims && claims.sub;
  if (!accountId) {
    const err = new Error('token has no subject claim');
    err.status = 401;
    throw err;
  }
  return { accountId, claims };
}

// Standard error responder for API routes — strips internal detail in
// production to avoid leaking server context.
function sendError(res, err) {
  const status = (err && err.status) || 500;
  const body = { error: err && err.message || 'internal_error' };
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = { requireAccount, sendError };
