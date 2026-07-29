const fs = require('fs');
const path = require('path');
const axios = require('axios');

const IMAGES_DIR = path.join(__dirname, '..', 'assets', 'images', 'guides');
const GUIDES_DIR = path.join(__dirname, '..', '_guides');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Generate AI image prompt from topic
function generateImagePrompt(title, tags) {
  // Create a concise prompt for FLUX - avoid mentioning title to prevent text generation
  // CRITICAL: Multiple emphatic instructions to prevent text generation
  // Expand common acronyms to avoid content filtering issues
  const keywords = tags.slice(0, 3)
    .map(tag => {
      // Expand common ML/AI acronyms to avoid content filtering
      const expansions = {
        'cnn': 'convolutional networks',
        'rnn': 'recurrent networks',
        'gpt': 'generative models',
        'ai': 'artificial intelligence',
        'ml': 'machine learning',
        'nlp': 'natural language processing',
        'cv': 'computer vision'
      };
      return expansions[tag.toLowerCase()] || tag;
    })
    .join(', ');

  return {
    // Generic prompt without topic keywords to avoid content filtering
    prompt: `Editorial fashion textile collage: overlapping swatches and draped sections of linen, denim, wool, silk, corduroy, cotton, knit, velvet, and canvas mixed with tasteful printed leopard, zebra, tiger-stripe, and snakeskin patterns; varied fabric weights, visible weave, stitching, folds, and tactile contrast; sophisticated fashion-magazine composition with blue accents and warm studio lighting; printed patterns only, no real animals, no people, no hands, no faces, no text, no letters, no words, no typography`,
    negative_prompt: `real animals, animal bodies, fur pelts, taxidermy, people, person, humans, hands, faces, portraits, text, letters, words, typography, watermark, logo, flat vector icons, stock photo`
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
async function tryGenerateWithModel(promptData, modelUrl, modelName, steps, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}: Sending prompt to ${modelName}...`);

      const requestBody = {
        prompt: promptData.prompt,
        width: 1024,
        height: 1024,
        seed: Math.floor(Math.random() * 1000000),
        steps: steps
      };

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
          timeout: 300000 // 5 minute timeout
        }
      );

      if (!response.data || !response.data.artifacts || response.data.artifacts.length === 0) {
        throw new Error('No image data in response');
      }

      const artifact = response.data.artifacts[0];
      if (artifact.finishReason !== 'SUCCESS') {
        throw new Error(`Image generation failed: ${artifact.finishReason}`);
      }

      return artifact.base64;

    } catch (error) {
      console.error(`✗ Attempt ${attempt} failed:`, error.message);
      if (error.response) {
        console.error('API Response:', JSON.stringify(error.response.data) || error.response.status);
      }

      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 10000; // 20s, 40s, 80s
        console.log(`Waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  return null;
}

// Generate and save image using NVIDIA's FLUX models with fallback
async function generateAndSaveImage(title, tags) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${slug}.jpg`;
  const filepath = path.join(IMAGES_DIR, filename);

  console.log(`Generating AI image for: ${title}`);

  const prompt = generateImagePrompt(title, tags);
  let imageBase64 = null;
  let modelUsed = null;

  console.log('\n🎨 Trying FLUX.1-dev (preferred model)...');
  imageBase64 = await tryGenerateWithModel(
    prompt,
    'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev',
    'FLUX.1-dev',
    50,
    1
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
      3
    );

    if (imageBase64) {
      modelUsed = 'schnell';
    }
  }

  // If all models failed
  if (!imageBase64) {
    console.error('⚠️  All attempts with all image models failed.');
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

// Update guide front matter with image data
function updateGuideFrontMatter(filepath, imageData) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontMatterMatch) {
    console.error('Could not find front matter');
    return false;
  }

  const oldFrontMatter = frontMatterMatch[0];
  let frontMatterContent = frontMatterMatch[1];

  // Check if image fields already exist
  if (frontMatterContent.includes('image:')) {
    console.log('Front matter already has image field, skipping update');
    return false;
  }

  // Add image fields
  const imageFields = `image: "${imageData.path}"
image_credit: "${imageData.credit}"
image_credit_url: "${imageData.credit_url}"`;

  const newFrontMatter = `---\n${frontMatterContent}\n${imageFields}\n---`;
  const newContent = content.replace(oldFrontMatter, newFrontMatter);

  fs.writeFileSync(filepath, newContent);
  console.log('Front matter updated successfully');
  return true;
}

async function main() {
  const guideFile = '2026-02-02-understanding-gradient-clipping.md';
  const guidePath = path.join(GUIDES_DIR, guideFile);

  if (!fs.existsSync(guidePath)) {
    console.error(`Guide not found: ${guideFile}`);
    process.exit(1);
  }

  console.log(`Adding image to: ${guideFile}\n`);

  // Parse front matter to get title and tags
  const content = fs.readFileSync(guidePath, 'utf-8');
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontMatterMatch) {
    console.error('Could not parse front matter');
    process.exit(1);
  }

  const frontMatter = frontMatterMatch[1];
  const titleMatch = frontMatter.match(/title:\s*"(.+?)"/);
  const tagsMatch = frontMatter.match(/tags:\s*\[(.*?)\]/);

  if (!titleMatch) {
    console.error('Could not find title');
    process.exit(1);
  }

  const title = titleMatch[1];
  const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/"/g, '')) : [];

  console.log(`Title: ${title}`);
  console.log(`Tags: ${tags.join(', ')}\n`);

  // Generate image
  const imageData = await generateAndSaveImage(title, tags);

  if (!imageData) {
    console.error('Failed to generate image');
    process.exit(1);
  }

  // Update front matter
  const updated = updateGuideFrontMatter(guidePath, imageData);

  if (updated) {
    console.log('\n✨ Done! Image added successfully.');
  } else {
    console.log('\n⚠️  Front matter not updated');
  }
}

if (require.main === module) {
  main();
}
