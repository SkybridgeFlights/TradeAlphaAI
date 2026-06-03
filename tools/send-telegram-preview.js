'use strict';

// Compatibility entrypoint for GitHub Actions editorial publishing.
// The implementation lives in telegram-publish-article.js so dry-run and
// real-send formatting stay in one place.

require('./telegram-publish-article.js');
