const fs = require('fs');
const path = require('path');

// Files to validate
const JSON_FILES = [
  'topics.json',
  'generated-topics.json',
  'package.json'
];

let hasErrors = false;

function getTopicSources(topic) {
  const rawSources = topic.sources || topic.source || [];
  const sources = Array.isArray(rawSources) ? rawSources : [rawSources];

  return sources
    .map(source => {
      if (typeof source === 'string') {
        return { url: source };
      }
      return { url: source && source.url };
    })
    .filter(source => source.url && /^https?:\/\//.test(source.url));
}

function validateContentSchema() {
  const root = path.join(__dirname, '..');
  const validArticleTypes = new Set(['style-guides', 'designer-spotlight', 'shop-spotlight']);
  const topicsPath = path.join(root, 'topics.json');
  const generatedTopicsPath = path.join(root, 'generated-topics.json');
  const guidesDir = path.join(root, '_guides');

  if (!fs.existsSync(topicsPath) || !fs.existsSync(generatedTopicsPath)) {
    return;
  }

  const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf-8'));
  const generatedTopics = JSON.parse(fs.readFileSync(generatedTopicsPath, 'utf-8'));
  const topicTitles = new Set();

  topics.forEach((topic, index) => {
    const label = topic.title || `topic at index ${index}`;

    if (!topic.title || typeof topic.title !== 'string') {
      console.error(`❌ topics.json: Missing string title for topic at index ${index}`);
      hasErrors = true;
    } else if (topicTitles.has(topic.title)) {
      console.error(`❌ topics.json: Duplicate topic title "${topic.title}"`);
      hasErrors = true;
    } else {
      topicTitles.add(topic.title);
    }

    if (topic.difficulty) {
      console.error(`❌ topics.json: "${label}" still uses deprecated difficulty`);
      hasErrors = true;
    }

    if (!validArticleTypes.has(topic.article_type)) {
      console.error(`❌ topics.json: "${label}" has invalid article_type "${topic.article_type}"`);
      hasErrors = true;
    }

    if (!Array.isArray(topic.tags) || topic.tags.length === 0) {
      console.error(`❌ topics.json: "${label}" must have at least one tag`);
      hasErrors = true;
    }

    const sources = getTopicSources(topic);
    if (sources.length < 2) {
      console.error(`❌ topics.json: "${label}" must have at least 2 valid source URLs`);
      hasErrors = true;
    }
  });

  generatedTopics.forEach(title => {
    if (!topicTitles.has(title)) {
      console.error(`❌ generated-topics.json: "${title}" is not present in topics.json`);
      hasErrors = true;
    }
  });

  if (!fs.existsSync(guidesDir)) {
    return;
  }

  fs.readdirSync(guidesDir)
    .filter(file => file.endsWith('.md'))
    .forEach(file => {
      const filePath = path.join(guidesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (!frontMatterMatch) {
        console.error(`❌ _guides/${file}: Missing front matter`);
        hasErrors = true;
        return;
      }

      const frontMatter = frontMatterMatch[1];
      const articleTypeMatch = frontMatter.match(/^article_type:\s*([^\n]+)$/m);

      if (/^difficulty:/m.test(frontMatter)) {
        console.error(`❌ _guides/${file}: Uses deprecated difficulty front matter`);
        hasErrors = true;
      }

      if (!articleTypeMatch) {
        console.error(`❌ _guides/${file}: Missing article_type front matter`);
        hasErrors = true;
      } else if (!validArticleTypes.has(articleTypeMatch[1].trim())) {
        console.error(`❌ _guides/${file}: Invalid article_type "${articleTypeMatch[1].trim()}"`);
        hasErrors = true;
      }
    });

  if (!hasErrors) {
    console.log('✅ Article taxonomy schema: Valid');
  }
}


console.log('🔍 Validating JSON files...\n');

JSON_FILES.forEach(file => {
  const filePath = path.join(__dirname, '..', file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file}: File not found (skipping)`);
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    JSON.parse(content);
    console.log(`✅ ${file}: Valid`);
  } catch (error) {
    console.error(`❌ ${file}: Invalid JSON`);
    console.error(`   Error: ${error.message}`);

    // Show context around the error
    if (error.message.includes('position')) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const match = error.message.match(/position (\d+)/);
        if (match) {
          const position = parseInt(match[1]);
          const start = Math.max(0, position - 50);
          const end = Math.min(content.length, position + 50);
          console.error(`   Context: ...${content.substring(start, end)}...`);
        }
      } catch (e) {
        // Ignore context errors
      }
    }

    hasErrors = true;
  }
});

validateContentSchema();

if (hasErrors) {
  console.error('\n❌ JSON validation failed');
  process.exit(1);
} else {
  console.log('\n✅ All JSON files are valid');
  process.exit(0);
}
