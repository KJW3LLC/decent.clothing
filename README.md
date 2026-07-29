# decent.clothing

decent.clothing is a Jekyll-powered food publication with automatically generated editorial articles.

## Article Types

- **Popular Recipes**: practical cooking ideas, recipes, techniques, pantry projects, and home-kitchen experiments.
- **Foodie Showcase**: food creator profiles, reviewer spotlights, food media analysis, and tastemaker coverage.
- **Hot Spot Showcase**: restaurant, bakery, bar, market, food truck, pop-up, and regional dining features.

## Features

- Automated article generation through `scripts/generate-guide.js`
- Search and filtering by article type
- JSON endpoints for articles, topics, series, and site index
- Jekyll layouts for article cards, article pages, structured data, feeds, and sitemaps

## Topic Format

Future topics in `topics.json` use this shape:

```json
{
  "title": "The Neighborhood Noodle Shop Worth Crossing Town For",
  "article_type": "hot-spot-showcase",
  "tags": ["hot-spot-showcase", "noodles", "neighborhood-restaurants"]
}
```

Valid `article_type` values:

- `popular-recipes`
- `foodie-showcase`
- `hot-spot-showcase`

## Common Commands

```bash
npm run generate
npm run add-topic
npm run validate
bundle exec jekyll build
```
