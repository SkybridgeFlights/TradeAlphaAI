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

// Standard error responder for API routes.
//
// A deliberate 4xx carries a message the caller needs in order to correct the
// request — a missing field, an uncovered symbol, a slug already in use — so
// those pass through unchanged. Every one of them is written for a client.
//
// Anything else is unplanned: a driver fault, a constraint this code did not
// anticipate, a misconfigured deployment. Those messages are written for an
// operator reading a log and routinely name tables, columns and environment
// variables. Returning one to an anonymous caller hands out a partial map of
// the schema in exchange for nothing, so the response is a fixed string and the
// real error goes to the server log instead — where it was always more useful.
function sendError(res, err) {
  const status = (err && err.status) || 500;
  const deliberate = status >= 400 && status < 500;
  if (!deliberate) {
    console.error('[api] unhandled error', {
      status,
      message: (err && err.message) || String(err),
      detail: (err && err.detail) || null,
      stack: (err && err.stack) || null,
    });
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: deliberate ? (err.message || 'request_error') : 'internal_error' }));
}

module.exports = { requireAccount, sendError };
