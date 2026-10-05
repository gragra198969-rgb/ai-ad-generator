import OpenAI from "openai";
import { sql } from "@/app/lib/db";
import { auth } from "@clerk/nextjs/server";
import { allowRequest, ensureAdOwnership } from "@/app/lib/ad-security";
import { assertSameOrigin, readJsonObject, RequestError, textField } from "@/app/lib/request-security";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ result: "Unauthorized" }, { status: 401 });
  let reserved = false;
  try {
    assertSameOrigin(req);
    const input = await readJsonObject(req);
    const product = textField(input, "product");
    const audience = textField(input, "audience");
    const benefit = textField(input, "benefit");
    const brandName = textField(input, "brandName", 200);
    const website = textField(input, "website", 2048);
    const tone = textField(input, "tone", 30) || "friendly";
    const adType = textField(input, "adType", 30) || "facebook";
    const adCount = input.adCount === undefined ? 5 : Number(input.adCount);
    if (!product || !audience) throw new RequestError("Product name and audience are required.");
    if (!Number.isInteger(adCount) || adCount < 1 || adCount > 20 || !["number", "string"].includes(typeof (input.adCount ?? 5))) {
      throw new RequestError("Choose between 1 and 20 ad ideas.");
    }
    if (!["friendly", "professional", "exciting"].includes(tone) ||
        !["facebook", "google", "email", "tiktok", "instagram", "twitter", "linkedin"].includes(adType)) {
      throw new RequestError("Choose a supported tone and channel.");
    }
    if (website) {
      let url: URL;
      try { url = new URL(website); } catch { throw new RequestError("Enter a valid http or https website URL."); }
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
        throw new RequestError("Enter a valid http or https website URL.");
      }
    }
    if (!process.env.OPENAI_API_KEY) return Response.json({ result: "Ad generation is not configured." }, { status: 503 });
    if (!await allowRequest(userId, "generation", 5)) return Response.json({ result: "Please wait a minute before generating again." }, { status: 429, headers: { "Retry-After": "60" } });
    await ensureAdOwnership();
    await sql`INSERT INTO users (clerk_user_id, ads_used, ads_limit) VALUES (${userId}, 0, 10) ON CONFLICT (clerk_user_id) DO NOTHING`;
    const accounts = await sql`UPDATE users SET ads_used = ads_used + 1 WHERE clerk_user_id = ${userId} AND ads_used < ads_limit RETURNING ads_used`;
    if (!accounts.length) return Response.json({ result: "You have used all your available generations." }, { status: 403 });
    reserved = true;
const brandSection = brandName
  ? `- The brand name is "${brandName}"
- Use the brand name naturally throughout the advertisements.
- Combine the brand name and product category when appropriate.
- Prefer using "${brandName}" in headlines.`
  : `- No brand name was provided.
- Focus on the product and benefit.`;
const totalAds = adCount;

const prompt = `


You are a world-class direct response copywriter.

Generate advertisements that are genuinely different from one another.

Each ad must use a unique:
- emotional trigger
- marketing angle
- writing style
- call to action

Avoid repeating phrases, structures, benefits, or themes.

The advertisements should feel as if they were written by different professional marketers.

Create exactly ${totalAds} highly persuasive ${adType} advertisements.

PRODUCT INFORMATION

Brand Name:
${brandName || "No brand specified"}

Product Name:
${product}

Target Audience:
${audience}

Primary Benefit:
${benefit}

Website:
${website || "No website provided"}

Tone:
${tone}

PRODUCT RULES

${brandSection}

If the product name is generic
(examples: Dog Food, Coffee, Protein Powder, Shoes),
treat it as a category rather than a branded product.

Avoid repeating the generic product category excessively.

Examples:

GOOD:
HealthyPup Dog Food
HealthyPup Nutrition
HealthyPup Formula
HealthyPup Meals

BAD:
Dog Food Dog Food Dog Food
Coffee Coffee Coffee
Shoes Shoes Shoes

HEALTH CLAIM RESTRICTIONS
Never imply that the product changes, improves, supports, enhances, boosts, optimizes, promotes, relieves, or affects any biological function.

Focus only on lifestyle benefits, routines, convenience, enjoyment, and customer aspirations.
The product may support general wellness only.

DO NOT claim that the product:

- improves digestion
- supports digestion
- promotes digestion
- improves gut health
- improves nutrient absorption
- relieves discomfort
- reduces symptoms
- solves digestive issues
- treats any condition
- prevents any condition
- cures any condition

Instead, focus on:

- daily wellness
- quality ingredients
- enjoyable routines
- caring for pets
- healthy lifestyle habits
- owner confidence
- overall wellbeing

If the user enters a health-related benefit,
rewrite it into a general wellness benefit.

HEADLINE RULES

- Headlines must be 4-10 words.
- Use the brand name when available.
- Every headline must be unique.
- Avoid generic headlines.
- Create curiosity and desire.

COPYWRITING RULES

- Write like a professional marketer
- Use emotional triggers
- Focus on benefits and outcomes
- Use curiosity and urgency
- Create unique angles for every ad
- Use persuasive language without invented social proof
- Ready for real-world advertising campaigns
- Every advertisement must use a different marketing angle.
- Do not repeat headlines.
- Do not repeat body copy themes.
- Make each advertisement feel independently written.

Each advertisement must have a completely different angle.

Possible angles include:
- convenience
- lifestyle
- emotional connection
- curiosity
- premium quality
- daily routine
- confidence
- value
- transformation
- aspirational identity

Do not reuse angles.
OUTPUT RULES

${website
  ? `- Use the exact website URL provided
- Include this URL in every CTA: ${website}`
  : `- Create a strong CTA without using a URL`}

- Return plain text only
- No markdown
- No code blocks
- No brackets around URLs


Format each advertisement exactly like:

========================
AD #X
=====

Headline:

Body Copy:

Call To Action:

IMPORTANT:
Generate EXACTLY ${totalAds} advertisements.
Do not generate more.
Do not generate fewer.
Number them AD #1 through AD #${totalAds}.

Return only the advertisements.
`;


    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90000, maxRetries: 0 });
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini", messages: [{ role: "user", content: prompt }], temperature: 0.9,
      max_completion_tokens: 6000,
    });
    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error("Empty generation");
    await sql`
      INSERT INTO ads (clerk_user_id, brand_name, product, audience, benefit, website, tone, ad_type, ad_count, generated_ads)
      VALUES (${userId}, ${brandName}, ${product}, ${audience}, ${benefit}, ${website}, ${tone}, ${adType}, ${totalAds}, ${result})
    `;
    return Response.json({ result });
  } catch (error) {
    if (reserved) {
      try {
        await sql`UPDATE users SET ads_used = GREATEST(0, ads_used - 1) WHERE clerk_user_id = ${userId}`;
      } catch {
        return Response.json({ result: "Generation failed and your credit could not be restored. Please contact support." }, { status: 500 });
      }
    }
    return Response.json({ result: error instanceof RequestError ? error.message : "Ad generation is temporarily unavailable. Please try again." },
      { status: error instanceof RequestError ? error.status : 503 });
  }
}
