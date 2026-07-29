# decent.clothing Content Strategy

decent.clothing uses article types as its editorial taxonomy. Every future article should belong to one of three categories:

- **Popular Recipes**: practical home cooking ideas, recipes, techniques, pantry moves, hosting, and kitchen experiments.
- **Foodie Showcase**: profiles and analysis of food creators, restaurant reviewers, recipe developers, food writers, and tastemakers.
- **Hot Spot Showcase**: restaurant, bakery, market, food truck, pop-up, cafe, bar, and regional dining coverage.

## Publishing Mix

Target a balanced rotation:

- Popular Recipes: 35%
- Foodie Showcase: 30%
- Hot Spot Showcase: 35%

This keeps the site useful for readers who want to cook, follow better food voices, and discover places worth visiting.

## Topic Schema

```json
{
  "title": "Article title",
  "article_type": "popular-recipes|foodie-showcase|hot-spot-showcase",
  "tags": ["tag-one", "tag-two", "tag-three"]
}
```

## Article Guidance

Popular Recipes articles should give readers something specific to make, improve, or try in their own kitchen.

Foodie Showcase articles should explain why a creator, critic, cook, newsletter, podcast, or social feed is useful, distinctive, and worth attention.

Hot Spot Showcase articles should make a place feel legible: what it serves, why people care, what to order, when to go, and what makes it different from the usual lists.

## Generation Notes

The generator should use `article_type` as the primary category and avoid instructional level labels.
