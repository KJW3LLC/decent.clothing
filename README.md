# decent.clothing

decent.clothing is a Jekyll-powered clothing publication with automatically generated editorial articles.

## Article Types

- **Style Guides**: practical advice on fit, wardrobe building, garment care, styling, and responsible shopping.
- **Designer Spotlight**: profiles of designers, labels, craftspeople, and distinct creative practices.
- **Shop Spotlight**: independent boutiques, concept stores, resale programs, and noteworthy fashion retailers.

## Features

- Automated article generation through `scripts/generate-guide.js`
- Search and filtering by article type
- JSON endpoints for articles, topics, series, and site index
- Jekyll layouts for article cards, article pages, structured data, feeds, and sitemaps

## Topic Format

Future topics in `topics.json` use this shape:

```json
{
  "title": "The Denim Fit Guide: Straight, Relaxed, Loose, and What Actually Changes",
  "article_type": "style-guides",
  "tags": ["style-guides", "denim", "fit"]
}
```

Valid `article_type` values:

- `style-guides`
- `designer-spotlight`
- `shop-spotlight`

## Common Commands

```bash
npm run generate
npm run add-topic
npm run validate
bundle exec jekyll build
```
