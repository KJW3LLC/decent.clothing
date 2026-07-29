# decent.clothing Content Strategy

decent.clothing uses article types as its editorial taxonomy. Every future article should belong to one of three categories:

- **Style Guides**: practical wardrobe, fit, garment-care, styling, textile, and responsible-shopping guidance.
- **Designer Spotlight**: profiles and analysis of designers, labels, craftspeople, and their creative practices.
- **Shop Spotlight**: independent boutiques, concept stores, resale programs, repair shops, and noteworthy fashion retailers.

## Publishing Mix

Target a balanced rotation:

- Style Guides: 35%
- Designer Spotlight: 30%
- Shop Spotlight: 35%

This keeps the site useful for readers who want to dress with intention, understand the people making clothes, and discover worthwhile places to shop.

## Topic Schema

```json
{
  "title": "Article title",
  "article_type": "style-guides|designer-spotlight|shop-spotlight",
  "tags": ["tag-one", "tag-two", "tag-three"]
}
```

## Article Guidance

Style Guides articles should give readers practical, source-backed help with fit, styling, wardrobe care, textiles, or shopping.

Designer Spotlight articles should explain a designer's point of view, craft, cultural context, and documented body of work.

Shop Spotlight articles should make a retailer or program legible: what it carries, why people care, how it operates, and what makes it distinct.

## Generation Notes

The generator should use `article_type` as the primary category and avoid instructional level labels.
