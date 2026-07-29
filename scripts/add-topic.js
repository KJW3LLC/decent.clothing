#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const TOPICS_FILE = path.join(__dirname, '..', 'topics.json');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify question
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

const ARTICLE_TYPES = ['popular-recipes', 'foodie-showcase', 'hot-spot-showcase'];

// Validate article type
function isValidArticleType(articleType) {
  return ARTICLE_TYPES.includes(articleType.toLowerCase());
}

// Main function
async function addTopic() {
  console.log('\n📝 Add New Article Topic to decent.clothing\n');
  console.log('This will add a new topic to topics.json\n');

  try {
    // Get title
    const title = await question('Topic title: ');
    if (!title.trim()) {
      console.log('❌ Title cannot be empty');
      process.exit(1);
    }

    // Get article type
    let article_type;
    while (true) {
      article_type = await question('Article type (popular-recipes/foodie-showcase/hot-spot-showcase): ');
      if (isValidArticleType(article_type)) {
        article_type = article_type.toLowerCase();
        break;
      }
      console.log('Invalid article type. Please use: popular-recipes, foodie-showcase, or hot-spot-showcase');
    }

    // Get tags
    const tagsInput = await question('Tags (comma-separated, e.g., "popular-recipes, weeknight-dinners, sauces"): ');
    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    if (tags.length === 0) {
      console.log('❌ At least one tag is required');
      process.exit(1);
    }

    // Create topic object
    const newTopic = {
      title: title.trim(),
      article_type,
      tags
    };

    // Load existing topics
    const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));

    // Check for duplicates
    const duplicate = topics.find(t => t.title.toLowerCase() === newTopic.title.toLowerCase());
    if (duplicate) {
      console.log(`\n⚠️  Warning: A topic with similar title already exists:`);
      console.log(`   "${duplicate.title}"`);
      const proceed = await question('\nAdd anyway? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('❌ Cancelled');
        process.exit(0);
      }
    }

    // Add new topic
    topics.push(newTopic);

    // Save topics
    fs.writeFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2) + '\n');

    console.log('\n✅ Topic added successfully!');
    console.log('\nNew topic:');
    console.log(JSON.stringify(newTopic, null, 2));
    console.log(`\nTotal topics: ${topics.length}`);
    console.log('\nNext steps:');
    console.log('1. Review the topic in topics.json');
    console.log('2. Commit and push: git add topics.json && git commit -m "Add topic: ' + title + '" && git push');
    console.log('3. The topic will be randomly selected for generation\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Show existing tag suggestions
async function showTagSuggestions() {
  const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
  const tagCounts = {};

  topics.forEach(topic => {
    topic.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  console.log('\n📊 Most used tags (for consistency):');
  sortedTags.forEach(([tag, count]) => {
    console.log(`   ${tag} (${count})`);
  });
  console.log('');
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node scripts/add-topic.js [options]

Options:
  --tags, -t    Show most used tags
  --help, -h    Show this help message

Interactive mode (default):
  Prompts for title, article_type, and tags to add a new topic to topics.json
`);
  process.exit(0);
}

if (args.includes('--tags') || args.includes('-t')) {
  showTagSuggestions();
  process.exit(0);
}

// Run interactive mode
addTopic();
