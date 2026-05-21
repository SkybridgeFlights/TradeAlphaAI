# Bilingual Publishing Workflow

Insight publishing is bilingual by default.

Workflow:
1. Discover or select an insight topic.
2. Generate the English article.
3. Generate the paired Arabic editorial content JSON in `data/localization/ar-insight-content/`.
4. Run localization so `/ar/insights/<slug>.html` is produced with the same structure.
5. Run insight quality checks, including Arabic counterpart checks.
6. Publish-safe updates English and Arabic pages, hreflang, indexes, research-layer data, and sitemaps.

If Arabic generation or validation fails, the pipeline stops before a successful publish-safe completion. Review drafts remain `noindex,nofollow` in both English and Arabic and are excluded from sitemaps.
