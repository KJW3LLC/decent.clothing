const fs = require("fs");
const path = require("path");
const axios = require("axios");

// File paths
const GUIDES_DIR = path.join(__dirname, "..", "_guides");
const IMAGES_DIR = path.join(__dirname, "..", "assets", "images", "guides");

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Parse front matter from markdown content
function parseFrontMatter(content) {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) return null;

  const frontMatterText = frontMatterMatch[1];
  const titleMatch = frontMatterText.match(/title:\s*"(.+?)"/);
  const tagsMatch = frontMatterText.match(/tags:\s*\[(.*?)\]/);
  const imageMatch = frontMatterText.match(/image:\s*"(.+?)"/);

  return {
    fullFrontMatter: frontMatterMatch[0],
    title: titleMatch ? titleMatch[1] : null,
    tags: tagsMatch
      ? tagsMatch[1].split(",").map((t) => t.trim().replace(/"/g, ""))
      : [],
    hasImage: !!imageMatch,
  };
}

// Generate AI image prompt from topic
function generateImagePrompt(title, tags) {
  const keywords = tags
    .slice(0, 3)
    .map((tag) => tag.replace(/-/g, " "))
    .join(", ");

  return {
    prompt: `Editorial fashion textile collage inspired by ${keywords}: overlapping swatches and draped sections of linen, denim, wool, silk, corduroy, cotton, knit, velvet, and canvas mixed with tasteful printed leopard, zebra, tiger-stripe, and snakeskin patterns; varied fabric weights, visible weave, stitching, folds, and tactile contrast; sophisticated fashion-magazine composition with decent.clothing blue accents and warm studio lighting; printed patterns only, no real animals, no people, no hands, no faces, no text, no letters, no words, no typography`,
    negative_prompt: `real animals, animal bodies, fur pelts, taxidermy, people, person, humans, hands, faces, portraits, text, letters, words, typography, watermark, logo, flat vector icons, stock photo`,
  };
}

// Helper function to try generating image with the newer FLUX.2 endpoint.
async function tryGenerateWithFlux2(promptData, maxRetries = 1) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `  Attempt ${attempt}/${maxRetries}: Sending prompt to FLUX.2-klein-4b...`,
      );

      const response = await axios.post(
        "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b",
        {
          prompt: promptData.prompt,
          width: 1024,
          height: 1024,
          cfg_scale: 1,
          samples: 1,
          seed: Math.floor(Math.random() * 1000000),
          steps: 4,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 180000,
        },
      );

      const artifact = response.data?.artifacts?.[0];
      if (!artifact?.base64) {
        throw new Error("No image data in response");
      }
      if (artifact.finishReason && artifact.finishReason !== "SUCCESS") {
        throw new Error(`Image generation failed: ${artifact.finishReason}`);
      }

      return artifact.base64;
    } catch (error) {
      console.error(`  ✗ Attempt ${attempt} failed:`, error.message);
      if (error.response) {
        console.error(
          "  API Response:",
          JSON.stringify(error.response.data) || error.response.status,
        );
      }
    }
  }

  return null;
}

// Helper function to try generating image with a specific FLUX model

async function tryGenerateWithModel(
  promptData,
  modelUrl,
  modelName,
  steps,
  maxRetries = 3,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `  Attempt ${attempt}/${maxRetries}: Sending prompt to ${modelName}...`,
      );

      const requestBody = {
        prompt: promptData.prompt,
        width: 1024,
        height: 1024,
        seed: Math.floor(Math.random() * 1000000),
        steps: steps,
      };

      // Note: Negative prompt may not be supported by NVIDIA FLUX API
      // Commenting out for now to avoid 422 errors
      // if (promptData.negative_prompt && modelName.includes('dev')) {
      //   requestBody.negative_prompt = promptData.negative_prompt;
      // }

      const response = await axios.post(modelUrl, requestBody, {
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 300000, // 5 minute timeout
      });

      if (
        !response.data ||
        !response.data.artifacts ||
        response.data.artifacts.length === 0
      ) {
        throw new Error("No image data in response");
      }

      const artifact = response.data.artifacts[0];
      if (artifact.finishReason !== "SUCCESS") {
        throw new Error(`Image generation failed: ${artifact.finishReason}`);
      }

      return artifact.base64;
    } catch (error) {
      console.error(`  ✗ Attempt ${attempt} failed:`, error.message);
      if (error.response) {
        console.error(
          "  API Response:",
          JSON.stringify(error.response.data) || error.response.status,
        );
      }

      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 10000; // 20s, 40s, 80s
        console.log(`  Waiting ${waitTime / 1000}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  return null;
}

// Generate and save image using NVIDIA's FLUX models with fallback
async function generateAndSaveImage(title, tags) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${slug}.jpg`;
  const filepath = path.join(IMAGES_DIR, filename);

  // Check if image already exists
  if (fs.existsSync(filepath)) {
    console.log(`  Image already exists: ${filename}`);
    return {
      path: `/assets/images/guides/${filename}`,
      credit: "Generated by NVIDIA FLUX.1-schnell",
      credit_url: "https://build.nvidia.com/black-forest-labs/flux_1-schnell",
    };
  }

  console.log(`  Generating AI image with NVIDIA FLUX...`);

  const prompt = generateImagePrompt(title, tags);
  let imageBase64 = null;
  let modelUsed = null;

  console.log("  🎨 Trying FLUX.1-dev (preferred model)...");
  imageBase64 = await tryGenerateWithModel(
    prompt,
    "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev",
    "FLUX.1-dev",
    50,
    1,
  );

  if (imageBase64) {
    modelUsed = "dev";
  } else {
    console.log("  🔄 FLUX.1-dev failed, falling back to FLUX.2-klein-4b...");
    imageBase64 = await tryGenerateWithFlux2(prompt, 1);

    if (imageBase64) {
      modelUsed = "klein";
    }
  }

  if (!imageBase64) {
    console.log(
      "  🔄 FLUX.2-klein-4b failed, falling back to FLUX.1-schnell...",
    );
    imageBase64 = await tryGenerateWithModel(
      prompt,
      "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell",
      "FLUX.1-schnell",
      4,
      3,
    );

    if (imageBase64) {
      modelUsed = "schnell";
    }
  }

  // If all models failed

  if (!imageBase64) {
    console.error("  ⚠️  All attempts with all image models failed.");
    return null;
  }

  // Save the image
  const imageBuffer = Buffer.from(imageBase64, "base64");
  fs.writeFileSync(filepath, imageBuffer);

  const creditInfo =
    modelUsed === "klein"
      ? {
          credit: "Generated by NVIDIA FLUX.2-klein-4b",
          credit_url:
            "https://build.nvidia.com/black-forest-labs/flux_2-klein-4b",
        }
      : modelUsed === "schnell"
        ? {
            credit: "Generated by NVIDIA FLUX.1-schnell",
            credit_url:
              "https://build.nvidia.com/black-forest-labs/flux_1-schnell",
          }
        : {
            credit: "Generated by NVIDIA FLUX.1-dev",
            credit_url: "https://build.nvidia.com/black-forest-labs/flux_1-dev",
          };

  console.log(`  ✓ AI-generated image saved: ${filename} (using ${modelUsed})`);

  return {
    path: `/assets/images/guides/${filename}`,
    ...creditInfo,
  };
}

// Update guide front matter with image data
function updateGuideFrontMatter(filepath, content, imageData) {
  try {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      console.error("  Could not find front matter");
      return false;
    }

    const oldFrontMatter = frontMatterMatch[0];
    let frontMatterContent = frontMatterMatch[1];

    // Check if image fields already exist
    if (frontMatterContent.includes("image:")) {
      console.log("  Front matter already has image field, skipping update");
      return false;
    }

    // Add image fields before the closing ---
    const imageFields = `image: "${imageData.path}"
image_credit: "${imageData.credit}"
image_credit_url: "${imageData.credit_url}"`;

    const newFrontMatter = `---\n${frontMatterContent}\n${imageFields}\n---`;
    const newContent = content.replace(oldFrontMatter, newFrontMatter);

    fs.writeFileSync(filepath, newContent);
    console.log("  Front matter updated successfully");
    return true;
  } catch (error) {
    console.error(`  Error updating front matter: ${error.message}`);
    return false;
  }
}

// Process a single guide
async function processGuide(filename) {
  const filepath = path.join(GUIDES_DIR, filename);
  const content = fs.readFileSync(filepath, "utf-8");

  const frontMatter = parseFrontMatter(content);
  if (!frontMatter) {
    console.log(`⚠️  ${filename}: Could not parse front matter, skipping`);
    return { processed: false, reason: "invalid_front_matter" };
  }

  if (!frontMatter.title) {
    console.log(`⚠️  ${filename}: No title found, skipping`);
    return { processed: false, reason: "no_title" };
  }

  if (frontMatter.hasImage) {
    console.log(`✓  ${filename}: Already has image, skipping`);
    return { processed: false, reason: "has_image" };
  }

  console.log(`\n📝 Processing: ${frontMatter.title}`);

  // Generate image
  const imageData = await generateAndSaveImage(
    frontMatter.title,
    frontMatter.tags,
  );
  if (!imageData) {
    console.log(`✗  ${filename}: Failed to generate image`);
    return { processed: false, reason: "generation_failed" };
  }

  // Update front matter
  const updated = updateGuideFrontMatter(filepath, content, imageData);
  if (!updated) {
    console.log(`✗  ${filename}: Failed to update front matter`);
    return { processed: false, reason: "update_failed" };
  }

  console.log(`✓  ${filename}: Successfully added image`);
  return { processed: true };
}

// Main function
async function main() {
  try {
    console.log("🎨 Retroactive Image Generation for Existing Guides\n");
    console.log("=================================================\n");

    // Check for API key
    if (!process.env.NVIDIA_API_KEY) {
      throw new Error("NVIDIA_API_KEY environment variable is not set");
    }

    // Get all guide files
    const guideFiles = fs
      .readdirSync(GUIDES_DIR)
      .filter((file) => file.endsWith(".md"))
      .sort();

    if (guideFiles.length === 0) {
      console.log("No guide files found in _guides/");
      return;
    }

    console.log(`Found ${guideFiles.length} guide(s)\n`);

    // Process each guide
    const results = {
      processed: 0,
      skipped: 0,
      failed: 0,
      reasons: {},
    };

    for (const file of guideFiles) {
      const result = await processGuide(file);

      if (result.processed) {
        results.processed++;
      } else {
        results.skipped++;
        results.reasons[result.reason] =
          (results.reasons[result.reason] || 0) + 1;
      }

      // Add a small delay between API calls to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Print summary
    console.log("\n=================================================");
    console.log("\n📊 Summary:");
    console.log(`   ✓ Processed: ${results.processed}`);
    console.log(`   ⚠️  Skipped: ${results.skipped}`);

    if (results.skipped > 0) {
      console.log("\n   Skip reasons:");
      Object.entries(results.reasons).forEach(([reason, count]) => {
        console.log(`     - ${reason}: ${count}`);
      });
    }

    console.log("\n✨ Done!\n");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
