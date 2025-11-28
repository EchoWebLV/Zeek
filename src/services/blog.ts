import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import type { BlogPost, BlogRequest, GeminiBlogResponse } from "../types.js";

let ai: GoogleGenAI | null = null;

/**
 * Initialize the blog generator with Google AI
 */
export function initBlogGenerator(apiKey: string): void {
  ai = new GoogleGenAI({ apiKey });
  console.log("📝 Blog generator initialized");
}

/**
 * System prompt for generating privacy-focused blog posts
 */
const BLOG_SYSTEM_PROMPT = `You are an expert technical writer specializing in privacy technology, cryptography, and blockchain. You write for the Zeke Privacy Blog, which educates both newcomers and experts about privacy-preserving technology.

Your writing style:
- Clear and accessible, but technically accurate
- Uses analogies to explain complex concepts
- Balances depth with readability
- Passionate about privacy as a human right
- References real projects and technologies when relevant

Structure your blog posts with:
1. An engaging introduction that hooks the reader
2. Clear section headings
3. Technical explanations with practical examples
4. Real-world use cases and implications
5. A forward-looking conclusion

IMPORTANT:
- Write in Markdown format
- Include code examples where relevant (use \`\`\` blocks)
- Aim for 1500-2500 words
- NO hashtags
- Be technically accurate but accessible`;

/**
 * Generate a long-form blog post from a topic
 */
export async function generateBlogPost(request: BlogRequest): Promise<BlogPost> {
  if (!ai) {
    throw new Error("Blog generator not initialized. Call initBlogGenerator() first.");
  }

  console.log(`\n📝 Generating blog post for: "${request.topic}"`);

  const prompt = `${BLOG_SYSTEM_PROMPT}

TOPIC REQUEST: ${request.topic}

Write a comprehensive, well-researched blog post about this topic. The reader has paid for this content with a private Zcash transaction, so deliver exceptional value.

Respond in JSON format:
{
  "title": "An engaging, SEO-friendly title",
  "content": "The full blog post in Markdown format",
  "summary": "A 2-3 sentence summary for social sharing"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text ?? "{}") as GeminiBlogResponse;

    if (!result.title || !result.content) {
      throw new Error("Invalid response from Gemini - missing title or content");
    }

    // Count words in content
    const wordCount = result.content.split(/\s+/).filter(w => w.length > 0).length;

    const blogPost: BlogPost = {
      id: request.id,
      topic: request.topic,
      title: result.title,
      content: result.content,
      wordCount: wordCount,
      generatedAt: new Date(),
      txid: request.transaction.txid,
      amountPaid: request.transaction.amountZec,
    };

    console.log(`   ✅ Generated: "${blogPost.title}"`);
    console.log(`   📊 Word count: ${blogPost.wordCount}`);

    return blogPost;
  } catch (error) {
    console.error("Error generating blog post:", error);
    throw error;
  }
}

/**
 * Format a blog post for saving to file
 */
export function formatBlogPostForFile(post: BlogPost): string {
  const header = `---
title: "${post.title}"
topic: "${post.topic}"
generated: ${post.generatedAt.toISOString()}
word_count: ${post.wordCount}
txid: ${post.txid}
amount_paid: ${post.amountPaid} ZEC
---

`;

  return header + post.content;
}

/**
 * Save a blog post to the output directory
 */
export function saveBlogPost(post: BlogPost, outputDir: string): string {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create a safe filename from the title
  const safeTitle = post.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);

  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `${timestamp}-${safeTitle}.md`;
  const filepath = path.join(outputDir, filename);

  // Format and save
  const content = formatBlogPostForFile(post);
  fs.writeFileSync(filepath, content);

  console.log(`   💾 Saved to: ${filepath}`);

  // Also save a simple .txt version for easy reading
  const txtPath = filepath.replace(".md", ".txt");
  const txtContent = `${post.title}
${"=".repeat(post.title.length)}

Topic: ${post.topic}
Generated: ${post.generatedAt.toISOString()}
Word Count: ${post.wordCount}
Transaction: ${post.txid}
Amount Paid: ${post.amountPaid} ZEC

---

${post.content.replace(/#{1,6}\s/g, "").replace(/\*\*/g, "").replace(/`{3}[a-z]*\n/g, "\n").replace(/`{3}/g, "").replace(/`/g, "")}
`;
  fs.writeFileSync(txtPath, txtContent);
  console.log(`   💾 Saved text version to: ${txtPath}`);

  return filepath;
}

/**
 * Generate and save a blog post in one step
 */
export async function processRequest(
  request: BlogRequest,
  outputDir: string
): Promise<{ post: BlogPost; filepath: string }> {
  const post = await generateBlogPost(request);
  const filepath = saveBlogPost(post, outputDir);

  return { post, filepath };
}

/**
 * List all generated blog posts in a directory
 */
export function listBlogPosts(outputDir: string): Array<{ filename: string; title: string; date: string }> {
  if (!fs.existsSync(outputDir)) {
    return [];
  }

  const files = fs.readdirSync(outputDir).filter(f => f.endsWith(".md"));
  
  return files.map(filename => {
    const filepath = path.join(outputDir, filename);
    const content = fs.readFileSync(filepath, "utf-8");
    
    // Extract title from frontmatter
    const titleMatch = content.match(/title:\s*"([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : filename;
    
    // Extract date from filename
    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : "unknown";

    return { filename, title, date };
  });
}

/**
 * Get stats about generated blog posts
 */
export function getBlogStats(outputDir: string): {
  totalPosts: number;
  totalWords: number;
  totalRevenue: number;
} {
  if (!fs.existsSync(outputDir)) {
    return { totalPosts: 0, totalWords: 0, totalRevenue: 0 };
  }

  const files = fs.readdirSync(outputDir).filter(f => f.endsWith(".md"));
  let totalWords = 0;
  let totalRevenue = 0;

  for (const filename of files) {
    const filepath = path.join(outputDir, filename);
    const content = fs.readFileSync(filepath, "utf-8");

    // Extract word count from frontmatter
    const wordMatch = content.match(/word_count:\s*(\d+)/);
    if (wordMatch) {
      totalWords += parseInt(wordMatch[1]);
    }

    // Extract amount paid from frontmatter
    const amountMatch = content.match(/amount_paid:\s*([\d.]+)/);
    if (amountMatch) {
      totalRevenue += parseFloat(amountMatch[1]);
    }
  }

  return {
    totalPosts: files.length,
    totalWords,
    totalRevenue,
  };
}

