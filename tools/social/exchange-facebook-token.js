#!/usr/bin/env node
'use strict';

// Facebook Long-Lived Page Token exchange — one-shot helper.
//
// Run this ONCE with your App ID + App Secret + a fresh short-lived User
// Access Token from Graph API Explorer. It prints the long-lived Page Token
// that should go into the FACEBOOK_PAGE_ACCESS_TOKEN GitHub secret. That
// token does not expire as long as it is used at least once every 60 days,
// which the daily TradeAlpha Workflow comfortably guarantees.
//
// Usage:
//   node tools/social/exchange-facebook-token.js \
//     --app-id=YOUR_APP_ID \
//     --app-secret=YOUR_APP_SECRET \
//     --user-token=SHORT_LIVED_USER_TOKEN
//
// Or via env:
//   FB_APP_ID=... FB_APP_SECRET=... FB_USER_TOKEN=... node tools/social/exchange-facebook-token.js
//
// What the script does:
//   1. Exchanges the short-lived User Token for a long-lived User Token
//      (POST /oauth/access_token?grant_type=fb_exchange_token).
//   2. Calls /me/accounts with the long-lived User Token to retrieve the
//      Page-level access tokens for every page the user manages.
//   3. Prints each page's name + ID + token so you can copy the right one.

const https = require('https');

function arg(name, envName) {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (flag) return flag.slice(name.length + 3);
  return process.env[envName] || '';
}

const appId = arg('app-id', 'FB_APP_ID');
const appSecret = arg('app-secret', 'FB_APP_SECRET');
const userToken = arg('user-token', 'FB_USER_TOKEN');

if (!appId || !appSecret || !userToken) {
  console.error('Missing input. Provide all three:');
  console.error('  --app-id=<App ID from Meta Developers>');
  console.error('  --app-secret=<App Secret>');
  console.error('  --user-token=<short-lived User Token from Graph API Explorer>');
  process.exit(1);
}

function graphGet(pathName) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: 'graph.facebook.com', port: 443, path: pathName }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        let json;
        try { json = JSON.parse(body); } catch { return reject(new Error('non-JSON response: ' + body.slice(0, 200))); }
        if (json.error) return reject(new Error(`Graph API error: ${json.error.message}`));
        resolve(json);
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    console.log('\n[step 1/2] Exchanging short-lived User Token for a long-lived User Token...');
    const exchangePath = `/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(userToken)}`;
    const exchange = await graphGet(exchangePath);
    if (!exchange.access_token) {
      console.error('Exchange returned no access_token:', exchange);
      process.exit(1);
    }
    const longLivedUser = exchange.access_token;
    const expiresInDays = exchange.expires_in ? Math.round(exchange.expires_in / 86400) : '~60';
    console.log(`           Long-lived User Token issued. Expires in: ${expiresInDays} days.\n`);

    console.log('[step 2/2] Fetching Page Access Tokens for every page the user manages...');
    const accountsPath = `/v18.0/me/accounts?access_token=${encodeURIComponent(longLivedUser)}`;
    const accounts = await graphGet(accountsPath);
    const pages = accounts.data || [];
    if (!pages.length) {
      console.error('No pages found. Did you grant pages_show_list + pages_manage_posts during token generation?');
      process.exit(1);
    }

    console.log(`           Found ${pages.length} page(s):\n`);
    console.log('============================================================');
    for (const page of pages) {
      console.log(`PAGE NAME : ${page.name}`);
      console.log(`PAGE ID   : ${page.id}    <-- FACEBOOK_PAGE_ID`);
      console.log(`PAGE TOKEN: ${page.access_token}`);
      console.log('            ^-- FACEBOOK_PAGE_ACCESS_TOKEN');
      console.log('            ^-- also INSTAGRAM_ACCESS_TOKEN (same token)');
      console.log('------------------------------------------------------------');
    }
    console.log('\nNEXT STEPS:');
    console.log('  1. Copy the PAGE TOKEN above (the long string).');
    console.log('  2. In GitHub: Settings -> Secrets and variables -> Actions');
    console.log('  3. Update both secrets with that same value:');
    console.log('     - FACEBOOK_PAGE_ACCESS_TOKEN');
    console.log('     - INSTAGRAM_ACCESS_TOKEN');
    console.log('  4. The token does NOT expire as long as the daily');
    console.log('     publishing workflow keeps using it.');
    console.log('\nDone.');
  } catch (err) {
    console.error('\nFAILED:', err.message);
    console.error('\nCommon causes:');
    console.error('  - App Secret typed wrong');
    console.error('  - User Token already expired (regenerate from Graph API Explorer)');
    console.error('  - Missing permissions on the User Token (need pages_show_list, pages_manage_posts)');
    process.exit(1);
  }
})();
