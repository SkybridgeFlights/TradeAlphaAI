/*
 * public-performance-config.js — single source of truth for the PUBLIC
 * snapshot base URL consumed by js/public-performance-data.js.
 *
 * This URL is PUBLIC (a Vercel Blob public store) and is NOT a secret. It
 * contains no write token. The Blob write credential lives ONLY on the
 * SYSTEM A / VPS publisher and must never appear in this repo.
 *
 * The consumer validates this value with isSafeBaseUrl() before any fetch and
 * only ever contacts this origin; page/query input can never override it.
 */
window.PUBLIC_SNAPSHOT_BASE_URL = 'https://wqtmrs9dqyxfnrlc.public.blob.vercel-storage.com';
