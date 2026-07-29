const axios = require('axios');
const fs = require('fs');
const path = require('path');

// NVIDIA API Configuration
const NVIDIA_API_BASE = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'nvidia/nemotron-3-super-120b-a12b';

// File paths
const TOPICS_FILE = path.join(__dirname, '..', 'topics.json');
const GENERATED_TOPICS_FILE = path.join(__dirname, '..', 'generated-topics.json');
const GUIDES_DIR = path.join(__dirname, '..', '_guides');
const IMAGES_DIR = path.join(__dirname, '..', 'assets', 'images', 'guides');

// Ensure directories exist
if (!fs.existsSync(GUIDES_DIR)) {
  fs.mkdirSync(GUIDES_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Read topics and generated topics
function loadTopics() {
  const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
  const generatedTopics = JSON.parse(fs.readFileSync(GENERATED_TOPICS_FILE, 'utf-8'));
  return { topics, generatedTopics };
}

// Save generated topics
function saveGeneratedTopics(generatedTopics) {
  fs.writeFileSync(GENERATED_TOPICS_FILE, JSON.stringify(generatedTopics, null, 2));
}

// Helper: Convert title to slug format for comparison
function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const ARTICLE_TYPES = {
  'popular-recipes': 'Popular Recipes',
  'foodie-showcase': 'Foodie Showcase',
  'hot-spot-showcase': 'Hot Spot Showcase'
};
const ARTICLE_TYPE_ORDER = Object.keys(ARTICLE_TYPES);

function getArticleTypeLabel(articleType) {
  return ARTICLE_TYPES[articleType] || 'Foodie Showcase';
}

function findTopicByGeneratedTitle(topics, generatedTitle) {
  const generatedSlug = titleToSlug(generatedTitle);
  return topics.find(topic =>
    topic.title === generatedTitle || titleToSlug(topic.title) === generatedSlug
  );
}

function getGeneratedArticleTypeCounts(topics, generatedTopics) {
  const counts = ARTICLE_TYPE_ORDER.reduce((acc, articleType) => {
    acc[articleType] = 0;
    return acc;
  }, {});

  generatedTopics.forEach(generatedTitle => {
    const topic = findTopicByGeneratedTitle(topics, generatedTitle);
    if (topic && topic.article_type) {
      counts[topic.article_type] = (counts[topic.article_type] || 0) + 1;
    }
  });

  return counts;
}

function getLastGeneratedArticleType(topics, generatedTopics) {
  for (let index = generatedTopics.length - 1; index >= 0; index--) {
    const topic = findTopicByGeneratedTitle(topics, generatedTopics[index]);
    if (topic && topic.article_type) {
      return topic.article_type;
    }
  }
  return null;
}

function selectBalancedStandaloneTopic(unusedTopics, topics, generatedTopics) {
  const generatedCounts = getGeneratedArticleTypeCounts(topics, generatedTopics);
  const availableTypes = ARTICLE_TYPE_ORDER.filter(articleType =>
    unusedTopics.some(topic => topic.article_type === articleType)
  );

  if (availableTypes.length === 0) {
    return unusedTopics[Math.floor(Math.random() * unusedTopics.length)];
  }

  const lowestCount = Math.min(...availableTypes.map(articleType => generatedCounts[articleType] || 0));
  const lowestTypes = availableTypes.filter(articleType => (generatedCounts[articleType] || 0) === lowestCount);
  const lastGeneratedType = getLastGeneratedArticleType(topics, generatedTopics);

  let selectedType = lowestTypes[0];
  if (lowestTypes.length > 1 && lastGeneratedType) {
    const lastIndex = ARTICLE_TYPE_ORDER.indexOf(lastGeneratedType);
    for (let offset = 1; offset <= ARTICLE_TYPE_ORDER.length; offset++) {
      const nextType = ARTICLE_TYPE_ORDER[(lastIndex + offset) % ARTICLE_TYPE_ORDER.length];
      if (lowestTypes.includes(nextType)) {
        selectedType = nextType;
        break;
      }
    }
  }

  const typeTopics = unusedTopics.filter(topic => topic.article_type === selectedType);
  const selected = typeTopics[Math.floor(Math.random() * typeTopics.length)];
  console.log(`⚖️  Balancing article types: selected ${getArticleTypeLabel(selectedType)} (${generatedCounts[selectedType] || 0} generated so far)`);
  return selected;
}

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

function getTopicSources(topic) {
  const rawSources = topic.sources || topic.source || [];
  const sources = Array.isArray(rawSources) ? rawSources : [rawSources];

  return sources
    .map((source, index) => {
      if (typeof source === 'string') {
        return { label: `Source ${index + 1}`, url: source };
      }

      return {
        label: source.label || source.title || `Source ${index + 1}`,
        url: source.url
      };
    })
    .filter(source => source.url && /^https?:\/\//.test(source.url));
}

function getTopicSourceGuidance(topic) {
  const sources = getTopicSources(topic);
  if (sources.length < 2) {
    throw new Error(`Topic "${topic.title}" must include at least 2 topic.sources links`);
  }

  const sourceList = sources
    .map((source, index) => `${index + 1}. [${source.label}](${source.url})`)
    .join('\n');

  return `\nPROVIDED SOURCE LINKS:\nUse these vetted topic sources for factual claims. Do not invent alternate URLs for this article. Include at least two of these exact links in the \"## Sources Cited\" section.\n${sourceList}`;
}

function getFactualSourceGuidance(topic) {
  if (topic.article_type === 'popular-recipes') {
    return `
POPULAR RECIPES FACTUAL REQUIREMENTS:
- Write about a REAL recipe, method, or dish pattern supported by the provided recipe sources.
- Do NOT invent measurements, cook times, temperatures, food safety claims, origin claims, substitutions, or technique claims that are not supported by the sources.
- Use and cite the provided recipe sources for factual claims, ingredient ideas, technique notes, timing, substitutions, and serving guidance.
- Compare what the sources agree on and where they differ, then give practical, careful guidance for home cooks.
- If a recipe detail may vary by oven, pan, ingredient size, brand, or taste, say so plainly.
- Include a "## Sources Cited" section with at least 2 provided topic source links before "## Further Reading".`;
  }

  if (topic.article_type === 'hot-spot-showcase') {

    return `
HOT SPOT SHOWCASE FACTUAL REQUIREMENTS:
- Write about one REAL, NAMED food location that exists in the real world, such as a restaurant, bakery, cafe, food truck, market stall, pop-up, bar, or counter-service spot.
- Do NOT invent a restaurant, chef, menu item, quote, neighborhood, award, origin story, wait time, opening date, ownership detail, or address.
- Include the actual location name, city, and neighborhood/area when available.
- Use and cite actual public sources. Prefer the location's official website/menu/social profile plus credible food media, local press, Michelin/James Beard/Eater/Infatuation/local newspaper coverage, or a reputable listing.
- Any factual information from another source must be cited with a markdown link in the same paragraph. If you include a direct quote, keep it short, put it in quotation marks, and cite the linked source immediately.
- For what to order, only mention dishes that are documented by an official menu/social post or reputable coverage. If details may change, say readers should verify current menu/hours before visiting.
- Do not imply that decent.clothing personally visited the location unless the source text says so. Use careful phrasing like "public menus list..." or "local coverage highlights..."
- Include a "## Sources Cited" section with 2-4 real links used for the article, before "## Further Reading".`;
  }

  if (topic.article_type === 'foodie-showcase') {
    return `
FOODIE SHOWCASE FACTUAL REQUIREMENTS:
- Write about one REAL, NAMED food content creator, chef-creator, blogger, newsletter writer, podcaster, restaurant reviewer, photographer, or food media personality.
- Do NOT invent a person, handle, platform, recipe, quote, collaboration, award, follower count, hometown, biography detail, or content example.
- Include the creator's real public name or publication name and their main public handle/site when available.
- Use and cite actual public sources. Prefer the creator's own website, newsletter, social profile, cookbook/podcast page, About page, and credible interviews or media coverage.
- Any factual information from another source must be cited with a markdown link in the same paragraph. If you include a direct quote, keep it short, put it in quotation marks, and cite the linked source immediately.
- Give credit for specific recipes, posts, videos, photos, newsletters, or creator ideas that inform the article. Do not describe content you cannot attribute to a linked source.
- Do not imply a personal relationship, interview, or direct permission from the creator unless the source text supports it.
- Include a "## Sources Cited" section with 2-4 real links used for the article, before "## Further Reading".`;
  }

  return `
FACTUAL ACCURACY REQUIREMENTS:
- Do not invent sources, claims, quotes, or links.
- Use the provided topic sources for factual claims.
- Cite any sourced factual claim with a real markdown link when referring to external reporting, recipes, or food culture references.
- Include a "## Sources Cited" section with at least 2 provided topic source links before "## Further Reading".`;
}

// Select next topic with smart series prioritization
// Priority order:
//   1. Continue in-progress series (previous part published)
//   2. Start any series (part 1)
//   3. Balance standalone topics by article type
function selectNextTopic(topics, generatedTopics) {
  const unusedTopics = topics.filter(
    topic => !generatedTopics.includes(topic.title)
  );

  if (unusedTopics.length === 0) {
    // All topics used, reset and start over
    console.log('All topics have been used. Resetting...');
    return topics[Math.floor(Math.random() * topics.length)];
  }

  // Convert generated topics to slug format for matching
  const generatedSlugs = generatedTopics.map(titleToSlug);

  // PRIORITY 1: Complete in-progress series (previous part already published)
  const continueSeriesTopics = unusedTopics.filter(topic => {
    if (!topic.series || !topic.series.previous) return false;

    // Check if the previous part has been generated
    const previousSlug = topic.series.previous;
    const previousPublished = generatedSlugs.some(slug => slug === previousSlug);

    return previousPublished;
  });

  if (continueSeriesTopics.length > 0) {
    // Sort by series part number to maintain order
    continueSeriesTopics.sort((a, b) => {
      if (a.series.name === b.series.name) {
        return a.series.part - b.series.part;
      }
      return 0;
    });

    const selected = continueSeriesTopics[0];
    console.log(`📚 Continuing series: "${selected.series.name}" (Part ${selected.series.part}/${selected.series.total})`);
    return selected;
  }

  // PRIORITY 2: Start any series
  const seriesStarts = unusedTopics.filter(topic =>
    topic.series && topic.series.part === 1
  );

  if (seriesStarts.length > 0) {
    const selected = seriesStarts[Math.floor(Math.random() * seriesStarts.length)];
    console.log(`📖 Starting series: "${selected.series.name}"`);
    return selected;
  }

  // FALLBACK: Balance standalone topics by article type
  const selected = selectBalancedStandaloneTopic(unusedTopics, topics, generatedTopics);
  console.log(`📄 Generating standalone topic`);
  return selected;
}

// Validate a URL by checking if it returns a successful response
async function validateUrl(url, timeout = 10000) {
  try {
    const response = await axios.head(url, {
      timeout,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });
    return true;
  } catch (error) {
    // Try GET if HEAD fails (some servers don't support HEAD)
    try {
      const response = await axios.get(url, {
        timeout,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
        responseType: 'stream'
      });
      // Cancel the stream immediately, we just need to check if it's accessible
      response.data.destroy();
      return true;
    } catch (getError) {
      console.log(`  ✗ Invalid URL: ${url} (${getError.message})`);
      return false;
    }
  }
}

// Extract and validate URLs from markdown content
async function validateLinksInContent(content, trustedUrls = []) {
  // Match markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const matches = [...content.matchAll(linkRegex)];

  if (matches.length === 0) {
    return content;
  }

  console.log(`Validating ${matches.length} links...`);

  const validatedLinks = await Promise.all(
    matches.map(async (match) => {
      const fullMatch = match[0];
      const text = match[1];
      const url = match[2];

      // Skip internal links (starting with /)
      if (url.startsWith('/') || url.startsWith('#')) {
        return { fullMatch, isValid: true };
      }

      const normalizedUrl = normalizeUrl(url);
      const isTrusted = trustedUrls.some(trustedUrl => normalizeUrl(trustedUrl) === normalizedUrl);
      if (isTrusted) {
        console.log(`  ✓ Trusted source: ${url}`);
        return { fullMatch, isValid: true };
      }

      const isValid = await validateUrl(url);
      if (isValid) {
        console.log(`  ✓ Valid: ${url}`);
      }

      return { fullMatch, isValid };
    })
  );

  // Remove invalid links from content
  let validatedContent = content;
  validatedLinks.forEach(({ fullMatch, isValid }) => {
    if (!isValid) {
      // Remove the entire line containing the invalid link
      const lines = validatedContent.split('\n');
      validatedContent = lines
        .filter(line => !line.includes(fullMatch))
        .join('\n');
    }
  });

  const removedCount = validatedLinks.filter(l => !l.isValid).length;
  if (removedCount > 0) {
    console.log(`Removed ${removedCount} invalid link(s)`);
  }

  return validatedContent;
}

function countMarkdownLinks(content) {
  return [...content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].length;
}

function validateArticleSourceRequirements(content, topic) {
  if (!content.includes('## Sources Cited')) {
    throw new Error(`${getArticleTypeLabel(topic.article_type)} articles must include a "## Sources Cited" section`);
  }

  const sourcesSection = content.split('## Sources Cited')[1]?.split('\n## ')[0] || '';
  const sourceLinks = countMarkdownLinks(sourcesSection);

  if (sourceLinks < 2) {
    throw new Error(`${getArticleTypeLabel(topic.article_type)} articles must include at least 2 valid source links in "## Sources Cited"`);
  }

  const topicSources = getTopicSources(topic);
  if (topicSources.length >= 2) {
    const normalizedSourcesSection = sourcesSection.replace(/\/$/gm, '');
    const usedProvidedSources = topicSources.filter(source =>
      normalizedSourcesSection.includes(normalizeUrl(source.url))
    );

    if (usedProvidedSources.length < 2) {
      throw new Error(`${getArticleTypeLabel(topic.article_type)} articles must include at least 2 provided topic.sources links in "## Sources Cited"`);
    }
  }
}

function validateArticleTypeFocus(content, topic) {
  const mismatchedHeadings = {
    'popular-recipes': ['### Foodie Showcase:', '### Hot Spot Showcase:'],
    'foodie-showcase': ['### Popular Recipes:', '### Hot Spot Showcase:'],
    'hot-spot-showcase': ['### Popular Recipes:', '### Foodie Showcase:']
  };

  const disallowed = mismatchedHeadings[topic.article_type] || [];
  const found = disallowed.find(heading => content.includes(heading));

  if (found) {
    throw new Error(`${getArticleTypeLabel(topic.article_type)} articles must not include mismatched practical detail heading "${found}"`);
  }
}

// Helper function to detect transient errors that should be retried
function isTransientError(error) {
  // Check for HTTP status codes indicating transient issues
  if (error.response) {
    const status = error.response.status;
    if (status === 502 || status === 503 || status === 504) {
      return true;
    }
  }

  // Check for network errors
  if (error.code) {
    const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENETUNREACH'];
    if (transientCodes.includes(error.code)) {
      return true;
    }
  }

  return false;
}

// Generate guide content with retry logic for transient errors
async function generateGuideContentWithRetry(topic, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  Text generation attempt ${attempt}/${maxRetries}...`);

      // Add series context if this is part of a series
      let seriesContext = '';
      if (topic.series) {
        seriesContext = `
SERIES CONTEXT:
This guide is part ${topic.series.part} of ${topic.series.total} in the "${topic.series.name}" series.`;

        if (topic.series.previous) {
          seriesContext += `\nPrevious guide: "${topic.series.previous.replace(/-/g, ' ')}"`;
        }
        if (topic.series.next) {
          seriesContext += `\nNext guide: "${topic.series.next.replace(/-/g, ' ')}"`;
        }

        seriesContext += `\n- Assume readers may have completed previous parts if applicable
- Build on concepts from earlier parts naturally
- Reference previous parts when helpful but don't require them
- Make this guide valuable both standalone AND as part of the series
`;
      }

      const prompt = `Create an editorial food article about "${topic.title}" for a food discovery website called "decent.clothing".\nArticle type: ${getArticleTypeLabel(topic.article_type)}.
${seriesContext}
${getFactualSourceGuidance(topic)}
${getTopicSourceGuidance(topic)}

WRITING STYLE & PERSONALITY:
- Write with personality! Be conversational, enthusiastic, and human
- Use "I" and "we" occasionally to create connection with readers
- Include personal observations, opinions, or insights where appropriate
- Share why YOU think this topic is interesting or important
- Use humor sparingly but effectively
- Show passion for food culture, social media trends, restaurant discovery, and creator storytelling
- Write like you're explaining to a curious friend over coffee, not lecturing
- Match the article type: ${getArticleTypeLabel(topic.article_type)}

VISUAL FORMATTING (CRITICAL - FOLLOW EXACTLY):
- ALWAYS use blockquote syntax for callout boxes. Each callout MUST start with > character
- Callout format examples (COPY THIS EXACT FORMAT):
  > **💡 Pro Tip:** Your tip text here

  > **⚠️ Watch Out:** Your warning text here

  > **🎯 Key Insight:** Your insight text here

- DO NOT write callouts as plain bold text like **💡 Pro Tip:**
- ALWAYS include the > character at the start of callout lines
- Add emojis strategically in headers and callouts to add visual interest
- Use **bold** liberally for emphasis
- Create variety in section structure

CONTENT STRUCTURE:
1. Article Title - Format as: **Title Text** on its own line, with NO equals-sign underline
2. Introduction (2-3 sentences with personality - hook the reader!)
3. Why It Matters - use ## header
4. Main article sections with clear ## headers (3-5 sections)
5. Practical Details:
   - Include ONLY the practical details for this article type: ${getArticleTypeLabel(topic.article_type)}
   - If Popular Recipes: include ingredients, steps, substitutions, and serving ideas
   - If Foodie Showcase: include the real creator's focus, what makes their credited work useful, where their voice fits in food culture, and what sourced public content to follow first
   - If Hot Spot Showcase: include the real location name, city/area, what documented menu items to order, when to go if sourced, who it is for, and what makes the place distinct
   - Do NOT include practical-detail subsections for the other article types
6. Key Takeaways (bullet points) - use ## header
7. Sources Cited (REQUIRED for all article types; include at least 2 provided topic source links used in the article) - use ## header
8. Further Reading (2-3 ACTUAL RESOURCES with real URLs as markdown links) - use ## header

CRITICAL HEADER FORMATTING RULES:
- First line must be the article title as bold text: **Title Text**
- Do NOT add an equals-sign underline under the title
- Use ## for all section headers (Why It Matters, main sections, Practical Details, Key Takeaways, Further Reading)
- Example of correct title format:
  **The Neighborhood Noodle Shop Worth Crossing Town For**

  Your introduction text here...
- DO NOT use just **bold text** for headers - they must be actual ## headers

FURTHER READING FORMAT:
Make these REAL, CLICKABLE links to actual resources. Format as:
- [Resource Title](https://actual-url.com) - Brief description of what it offers

Example:
- [Eater](https://www.eater.com/) - Restaurant news, city guides, and food culture reporting
- [Serious Eats](https://www.seriouseats.com/) - Deep recipe testing and cooking technique explainers

Write in Markdown format. Do NOT include the front matter (YAML) - only the content body.
Be friendly, be human, be helpful!`;

      const response = await axios.post(
        `${NVIDIA_API_BASE}/chat/completions`,
        {
          model: NVIDIA_MODEL,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          top_p: 1,
          max_tokens: 4096,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 300000 // 5 minute timeout
        }
      );

      let content = response.data.choices[0].message.content;

      // Strip thinking tokens emitted by reasoning models (e.g. Nemotron)
      content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trimStart();

      // Validate all links in the generated content
      const validatedContent = await validateLinksInContent(content, getTopicSources(topic).map(source => source.url));
      validateArticleSourceRequirements(validatedContent, topic);
      validateArticleTypeFocus(validatedContent, topic);

      console.log('  ✓ Text generation successful');
      return validatedContent;

    } catch (error) {
      const isTransient = isTransientError(error);
      const isContentQualityError = error.message?.includes('must include') || error.message?.includes('must not include');
      const errorMsg = error.response?.data?.message || error.message;
      const statusCode = error.response?.status || error.code;

      console.error(`  ✗ Attempt ${attempt} failed: ${statusCode} - ${errorMsg}`);

      // If it's a transient error and we have retries left, wait and retry
      if ((isTransient || isContentQualityError) && attempt < maxRetries) {
        const waitTime = isTransient ? Math.pow(2, attempt) * 15000 : 5000; // 30s, 60s, 120s for transient API errors
        const retryReason = isTransient ? 'Transient error' : 'Content quality requirement missed';
        console.log(`  ${retryReason} detected. Waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // Non-transient error or out of retries - throw immediately
        const apiError = error.response?.data?.error?.message || error.response?.data?.message || error.message;
        console.error('NVIDIA API Error:', apiError);
        throw error;
      }
    }
  }

  throw new Error('Text generation failed after all retry attempts');
}

// Backward compatibility wrapper
async function generateGuideContent(topic) {
  return generateGuideContentWithRetry(topic);
}

// Find related guides based on shared tags
function findRelatedGuides(topic, maxRelated = 3) {
  try {
    const guides = fs.readdirSync(GUIDES_DIR)
      .filter(file => file.endsWith('.md'))
      .map(file => {
        const content = fs.readFileSync(path.join(GUIDES_DIR, file), 'utf-8');
        const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontMatterMatch) return null;

        const frontMatter = frontMatterMatch[1];
        const titleMatch = frontMatter.match(/title:\s*"(.+?)"/);
        const tagsMatch = frontMatter.match(/tags:\s*\[(.*?)\]/);

        if (!titleMatch) return null;

        const title = titleMatch[1];
        const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/"/g, '')) : [];

        return { title, tags, file };
      })
      .filter(guide => guide !== null);

    // Calculate relevance score based on shared tags
    const scoredGuides = guides
      .map(guide => {
        const sharedTags = guide.tags.filter(tag => topic.tags.includes(tag));
        return {
          ...guide,
          score: sharedTags.length
        };
      })
      .filter(guide => guide.score > 0 && guide.title !== topic.title)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRelated);

    return scoredGuides.map(guide => ({
      title: guide.title,
      url: `/guides/${guide.file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '')}/`
    }));
  } catch (error) {
    console.error('Error finding related guides:', error.message);
    return [];
  }
}

// Create filename from title
function createFilename(title) {
  const date = new Date().toISOString().split('T')[0];
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${date}-${slug}.md`;
}

// Generate article description from title and article type
function generateDescription(title, articleType) {
  const starters = {
    'popular-recipes': 'A Popular Recipes article on',
    'foodie-showcase': 'A Foodie Showcase on',
    'hot-spot-showcase': 'A Hot Spot Showcase on'
  };
  return `${starters[articleType] || 'A decent.clothing article on'} ${title.toLowerCase()}`;
}

// Generate AI image prompt from topic
function generateImagePrompt(topic) {
  // Avoid article titles and names in image prompts; named people can trigger image content filters.
  const keywords = topic.tags.slice(0, 3)
    .map(tag => tag.replace(/-/g, ' '))
    .join(', ');

  return {
    prompt: `Colorful editorial food illustration inspired by ${keywords}: stylized illustrated food still life, vibrant hand-drawn shapes, playful composition, appetizing dishes related to the subject, bold color palette with decent.clothing blue accents, warm expressive lighting, modern magazine illustration, charming texture, no people, no hands, no faces, no text, no letters, no words, no typography`,
    negative_prompt: `people, person, humans, hands, faces, portraits, photorealistic, realistic photography, camera photo, stock photo, text, letters, words, typography, watermark, logo`
  };
}

// Helper function to try generating image with the newer FLUX.2 endpoint.
async function tryGenerateWithFlux2(promptData, maxRetries = 1, timeoutMs = 180000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}: Sending prompt to FLUX.2-klein-4b...`);

      const response = await axios.post(
        'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b',
        {
          prompt: promptData.prompt,
          width: 1024,
          height: 1024,
          cfg_scale: 1,
          samples: 1,
          seed: Math.floor(Math.random() * 1000000),
          steps: 4
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: timeoutMs
        }
      );

      const artifact = response.data?.artifacts?.[0];
      if (!artifact?.base64) {
        throw new Error('No image data in response');
      }
      if (artifact.finishReason && artifact.finishReason !== 'SUCCESS') {
        throw new Error(`Image generation failed: ${artifact.finishReason}`);
      }

      console.log('✓ Success! Image generated with FLUX.2-klein-4b');
      return artifact.base64;

    } catch (error) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
      const isServerError = error.response && error.response.status >= 500;

      console.error(`✗ Attempt ${attempt} failed: ${error.message}`);
      if (error.response?.data) {
        console.error(`   API Response:`, JSON.stringify(error.response.data));
      }

      if (isTimeout) {
        console.error(`   (Request timed out after ${timeoutMs/1000}s - API may be overloaded)`);
      } else if (isServerError) {
        console.error(`   (Server error - NVIDIA API may be experiencing issues)`);
      }
    }
  }

  return null;
}

// Helper function to try generating image with a specific FLUX model
async function tryGenerateWithModel(promptData, modelUrl, modelName, steps, maxRetries = 3, timeoutMs = 300000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const requestBody = {
      prompt: promptData.prompt,
      width: 1024,
      height: 1024,
      seed: Math.floor(Math.random() * 1000000),
      steps: steps
    };

    try {
      console.log(`Attempt ${attempt}/${maxRetries}: Sending prompt to ${modelName}...`);

      // Note: Negative prompt may not be supported by NVIDIA FLUX API
      // Commenting out for now to avoid 422 errors
      // if (promptData.negative_prompt && modelName.includes('dev')) {
      //   requestBody.negative_prompt = promptData.negative_prompt;
      // }

      const response = await axios.post(
        modelUrl,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: timeoutMs
        }
      );

      // Extract image data from response
      if (!response.data || !response.data.artifacts || response.data.artifacts.length === 0) {
        throw new Error('No image data in response');
      }

      const artifact = response.data.artifacts[0];
      if (artifact.finishReason !== 'SUCCESS') {
        throw new Error(`Image generation failed: ${artifact.finishReason}`);
      }

      console.log(`✓ Success! Image generated with ${modelName}`);
      return artifact.base64;

    } catch (error) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
      const isServerError = error.response && error.response.status >= 500;

      console.error(`✗ Attempt ${attempt} failed: ${error.message}`);

      if (error.response) {
        console.error(`   HTTP Status: ${error.response.status}`);
        if (error.response.data) {
          console.error(`   API Response:`, JSON.stringify(error.response.data));
        }
        if (error.response.headers) {
          console.error(`   Response Headers:`, JSON.stringify(error.response.headers));
        }
      }

      if (isTimeout) {
        console.error(`   (Request timed out after ${timeoutMs/1000}s - API may be overloaded)`);
      } else if (isServerError) {
        console.error(`   (Server error - NVIDIA API may be experiencing issues)`);
      }

      // Don't retry immediately on server errors - wait longer
      if (attempt < maxRetries) {
        const waitTime = isServerError ?
          Math.pow(2, attempt) * 15000 : // 30s, 60s for server errors
          Math.pow(2, attempt) * 10000;   // 20s, 40s for other errors
        console.log(`   Waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  return null;
}

// Generate and save image using NVIDIA's FLUX models with fallback
async function fetchAndSaveImage(topic) {
  const slug = topic.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${slug}.jpg`;
  const filepath = path.join(IMAGES_DIR, filename);

  // Check if image already exists
  if (fs.existsSync(filepath)) {
    console.log(`Image already exists: ${filename}`);
    return {
      path: `/assets/images/guides/${filename}`,
      credit: 'Generated by NVIDIA FLUX.1-schnell',
      credit_url: 'https://build.nvidia.com/black-forest-labs/flux_1-schnell'
    };
  }

  console.log(`Generating AI image for: ${topic.title}`);

  const prompt = generateImagePrompt(topic);
  let imageBase64 = null;
  let modelUsed = null;

  console.log('\n🎨 Trying FLUX.1-dev (preferred model)...');
  console.log('   Note: FLUX.1-dev uses 50 steps, so it can take longer');
  imageBase64 = await tryGenerateWithModel(
    prompt,
    'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev',
    'FLUX.1-dev',
    50,
    1,
    300000 // 5 minute timeout for dev model
  );

  if (imageBase64) {
    modelUsed = 'dev';
  } else {
    console.log('\n🔄 FLUX.1-dev failed, falling back to FLUX.2-klein-4b...');
    imageBase64 = await tryGenerateWithFlux2(prompt, 1, 180000);

    if (imageBase64) {
      modelUsed = 'klein';
    }
  }

  if (!imageBase64) {
    console.log('\n🔄 FLUX.2-klein-4b failed, falling back to FLUX.1-schnell...');
    imageBase64 = await tryGenerateWithModel(
      prompt,
      'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell',
      'FLUX.1-schnell',
      4,
      2,
      180000 // 3 minute timeout
    );

    if (imageBase64) {
      modelUsed = 'schnell';
    }
  }

  // If all models failed
  if (!imageBase64) {
    console.error('\n⚠️  All attempts with all image models failed.');
    console.error('    This may be a temporary NVIDIA API issue or image prompt content filtering.');
    console.error('    Guide will be created without image - you can generate the image later.');
    console.error('    To retry image generation for this guide, run:');
    console.error(`    node scripts/add-images-retroactive.js`);
    return null;
  }

  // Save the image
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  fs.writeFileSync(filepath, imageBuffer);

  const creditInfo = modelUsed === 'dev'
    ? {
        credit: 'Generated by NVIDIA FLUX.1-dev',
        credit_url: 'https://build.nvidia.com/black-forest-labs/flux_1-dev'
      }
    : modelUsed === 'klein'
      ? {
          credit: 'Generated by NVIDIA FLUX.2-klein-4b',
          credit_url: 'https://build.nvidia.com/black-forest-labs/flux_2-klein-4b'
        }
      : {
          credit: 'Generated by NVIDIA FLUX.1-schnell',
          credit_url: 'https://build.nvidia.com/black-forest-labs/flux_1-schnell'
        };

  console.log(`✓ AI-generated image saved: ${filename} (using ${modelUsed})`);

  return {
    path: `/assets/images/guides/${filename}`,
    ...creditInfo
  };
}

// Create guide file
async function createGuideFile(topic, content, imageData) {
  const filename = createFilename(topic.title);
  const filepath = path.join(GUIDES_DIR, filename);

  const date = new Date().toISOString().split('T')[0];
  const description = generateDescription(topic.title, topic.article_type);

  // Find related guides
  const relatedGuides = findRelatedGuides(topic);

  // Add related guides section if any found
  if (relatedGuides.length > 0) {
    content += `\n\n## Related Guides\n\n`;
    content += `Want to learn more? Check out these related guides:\n\n`;
    relatedGuides.forEach(guide => {
      content += `- [${guide.title}](${guide.url})\n`;
    });
  }

  // Estimate reading time (rough: 200 words per minute)
  const wordCount = content.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200);

  // Build front matter with optional image data and series info
  let frontMatter = `---
layout: guide
title: "${topic.title}"
date: ${date}
article_type: ${topic.article_type}
tags: [${topic.tags.map(tag => `"${tag}"`).join(', ')}]
description: "${description}"
estimated_time: "${readingTime} min read"`;

  if (imageData) {
    frontMatter += `
image: "${imageData.path}"
image_credit: "${imageData.credit}"
image_credit_url: "${imageData.credit_url}"`;
  }

  // Add series metadata if present
  if (topic.series) {
    frontMatter += `
series:
  name: "${topic.series.name}"
  part: ${topic.series.part}
  total: ${topic.series.total}
`;

    if (topic.series.previous) {
      frontMatter += `  previous: "${topic.series.previous}"
`;
    }
    if (topic.series.next) {
      frontMatter += `  next: "${topic.series.next}"
`;
    }
  }

  frontMatter += `
---

`;

  const fullContent = frontMatter + content;
  fs.writeFileSync(filepath, fullContent);

  console.log(`Created guide: ${filename}`);
  if (relatedGuides.length > 0) {
    console.log(`Added ${relatedGuides.length} related guide links`);
  }
  return filename;
}

// Update series navigation in all guides of the same series
function updateSeriesNavigation(newTopic) {
  if (!newTopic.series) {
    return;
  }

  console.log('\nUpdating series navigation for all guides in the series...');

  // Load topics.json to get the authoritative series structure
  const { topics } = loadTopics();

  // Find all topics in the same series
  const seriesTopics = topics.filter(t =>
    t.series && t.series.name === newTopic.series.name
  ).sort((a, b) => a.series.part - b.series.part);

  if (seriesTopics.length === 0) {
    console.log('  ⚠ No series topics found in topics.json');
    return;
  }

  console.log(`  Found ${seriesTopics.length} parts in "${newTopic.series.name}" series`);

  // Update each guide in the series to match topics.json
  seriesTopics.forEach((topic, index) => {
    const slug = titleToSlug(topic.title);
    const files = fs.readdirSync(GUIDES_DIR).filter(f => f.includes(slug));

    if (files.length === 0) {
      // Guide hasn't been created yet, skip it
      return;
    }

    const filePath = path.join(GUIDES_DIR, files[0]);
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // Update part number if different
    const currentPartMatch = content.match(/part:\s*(\d+)/m);
    if (currentPartMatch && parseInt(currentPartMatch[1]) !== topic.series.part) {
      content = content.replace(/part:\s*\d+/m, `part: ${topic.series.part}`);
      console.log(`  ✓ Updated ${files[0]}: part ${currentPartMatch[1]} → ${topic.series.part}`);
      modified = true;
    }

    // Update total if different
    const currentTotalMatch = content.match(/total:\s*(\d+)/m);
    if (currentTotalMatch && parseInt(currentTotalMatch[1]) !== topic.series.total) {
      content = content.replace(/total:\s*\d+/m, `total: ${topic.series.total}`);
      console.log(`  ✓ Updated ${files[0]}: total ${currentTotalMatch[1]} → ${topic.series.total}`);
      modified = true;
    }

    // Update previous link
    const shouldHavePrevious = index > 0;
    const hasPreviousLink = /previous:\s*"[^"]+"/m.test(content);

    if (shouldHavePrevious) {
      const prevSlug = titleToSlug(seriesTopics[index - 1].title);
      const currentPrevMatch = content.match(/previous:\s*"([^"]+)"/m);

      // Check if previous guide actually exists
      const prevGuideExists = fs.readdirSync(GUIDES_DIR).some(f => f.includes(prevSlug));

      if (prevGuideExists) {
        if (!hasPreviousLink) {
          // Add previous link after part line
          content = content.replace(
            /(part:\s*\d+)\n/m,
            `$1\n  total: ${topic.series.total}\n  previous: "${prevSlug}"\n`
          );
          // Remove duplicate total if it exists
          content = content.replace(/total:\s*\d+\n\s*total:\s*\d+/m, (match) => {
            const totalMatch = match.match(/total:\s*(\d+)/);
            return `total: ${totalMatch[1]}`;
          });
          console.log(`  ✓ Added previous link to ${files[0]}: ${prevSlug}`);
          modified = true;
        } else if (currentPrevMatch && currentPrevMatch[1] !== prevSlug) {
          content = content.replace(/previous:\s*"[^"]+"/m, `previous: "${prevSlug}"`);
          console.log(`  ✓ Fixed previous link in ${files[0]}: ${prevSlug}`);
          modified = true;
        }
      } else if (hasPreviousLink) {
        // Remove previous link if target guide doesn't exist
        content = content.replace(/\s*previous:\s*"[^"]+"\n/m, '');
        console.log(`  ✓ Removed previous link to non-existent guide from ${files[0]}`);
        modified = true;
      }
    } else if (hasPreviousLink) {
      // Remove previous link if this is now part 1
      content = content.replace(/\s*previous:\s*"[^"]+"\n/m, '');
      console.log(`  ✓ Removed incorrect previous link from ${files[0]}`);
      modified = true;
    }

    // Update next link
    const shouldHaveNext = index < seriesTopics.length - 1;
    const hasNextLink = /next:\s*"[^"]+"/m.test(content);

    if (shouldHaveNext) {
      const nextSlug = titleToSlug(seriesTopics[index + 1].title);
      const currentNextMatch = content.match(/next:\s*"([^"]+)"/m);

      // Check if next guide actually exists
      const nextGuideExists = fs.readdirSync(GUIDES_DIR).some(f => f.includes(nextSlug));

      if (nextGuideExists) {
        if (!hasNextLink) {
          // Add next link
          const hasPreviousLine = /previous:\s*"[^"]+"/m.test(content);
          if (hasPreviousLine) {
            content = content.replace(
              /(previous:\s*"[^"]+")\n/m,
              `$1\n  next: "${nextSlug}"\n`
            );
          } else {
            content = content.replace(
              /(total:\s*\d+)\n/m,
              `$1\n  next: "${nextSlug}"\n`
            );
          }
          console.log(`  ✓ Added next link to ${files[0]}: ${nextSlug}`);
          modified = true;
        } else if (currentNextMatch && currentNextMatch[1] !== nextSlug) {
          content = content.replace(/next:\s*"[^"]+"/m, `next: "${nextSlug}"`);
          console.log(`  ✓ Fixed next link in ${files[0]}: ${nextSlug}`);
          modified = true;
        }
      } else if (hasNextLink) {
        // Remove next link if target guide doesn't exist
        content = content.replace(/\s*next:\s*"[^"]+"\n/m, '');
        console.log(`  ✓ Removed next link to non-existent guide from ${files[0]}`);
        modified = true;
      }
    } else if (hasNextLink) {
      // Remove next link if this is now the last part
      content = content.replace(/\s*next:\s*"[^"]+"\n/m, '');
      console.log(`  ✓ Removed incorrect next link from ${files[0]}`);
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
    }
  });
}

// Main function
async function main() {
  try {
    console.log('Starting guide generation...');

    // Check for API key
    if (!process.env.NVIDIA_API_KEY) {
      throw new Error('NVIDIA_API_KEY environment variable is not set');
    }

    // Load topics
    const { topics, generatedTopics } = loadTopics();
    console.log(`Loaded ${topics.length} topics, ${generatedTopics.length} already generated`);

    // Select topic
    const topic = selectNextTopic(topics, generatedTopics);
    console.log(`Selected topic: ${topic.title} (${getArticleTypeLabel(topic.article_type)})`);

    // Generate content
    console.log('Generating content with NVIDIA API...');
    const content = await generateGuideContent(topic);

    // Wait a moment before image generation to avoid rate limiting
    console.log('Waiting 5 seconds before image generation...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Fetch image
    console.log('Fetching image...');
    const imageData = await fetchAndSaveImage(topic);

    // Create guide file
    const filename = await createGuideFile(topic, content, imageData);

    // Update series navigation in adjacent guides
    updateSeriesNavigation(topic);

    // Update generated topics
    if (!generatedTopics.includes(topic.title)) {
      generatedTopics.push(topic.title);
      saveGeneratedTopics(generatedTopics);
    }

    console.log('Guide generation complete!');
    console.log(`Total guides generated: ${generatedTopics.length}/${topics.length}`);

  } catch (error) {
    console.error('Error generating guide:', error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    if (error.response?.status) {
      console.error(`HTTP status: ${error.response.status}`);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
