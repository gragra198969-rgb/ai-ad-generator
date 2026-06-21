import OpenAI from "openai";
import { sql } from "@/app/lib/db";
import { auth } from "@clerk/nextjs/server";

console.log("ROUTE FILE LOADED");

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY,
});
export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { result: "Unauthorized" },
      { status: 401 }
    );
  }
  await sql`
  INSERT INTO users (clerk_user_id)
  VALUES (${userId})
  ON CONFLICT (clerk_user_id)
  DO NOTHING
`;

const userRecord = await sql`
  SELECT *
  FROM users
  WHERE clerk_user_id = ${userId}
`;

const user = userRecord[0];

if (user.ads_used >= user.ads_limit) {
  return Response.json(
    {
      result: "You have used all 50 free ads this month."
    },
    {
      status: 403
    }
  );
}
console.log("POST /api/generate was called");
try {
const {
  product,
  audience,
  benefit,
  website,
  tone,
  adType,
  adCount,
  brandName = "",
} = await req.json();
if (!product || !audience) {
  return Response.json(
    {
      result: "Product name and audience are required.",
    },
    {
      status: 400,
    }
  );
}


const brandSection = brandName
  ? `- The brand name is "${brandName}"
- Use the brand name naturally throughout the advertisements.
- Combine the brand name and product category when appropriate.
- Prefer using "${brandName}" in headlines.`
  : `- No brand name was provided.
- Focus on the product and benefit.`;
const totalAds = Math.min(
  20,
  Math.max(1, Number(adCount) || 5)
);

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

console.log({
product,
audience,
benefit,
website,
tone,
adType,
adCount,
brandName,
});
const response = await openai.chat.completions.create({
  model: "gpt-4.1-mini",
  messages: [
    {
      role: "user",
      content: prompt,
    },
  ],
  temperature: 0.9,
});

const result =
  response.choices[0]?.message?.content ||
  "No ad generated.";
await sql`
  UPDATE users
  SET ads_used = ads_used + 1
  WHERE clerk_user_id = ${userId}
`;
  console.log("Saving ad to Neon...");

  await sql`
  INSERT INTO ads (
    brand_name,
    product,
    audience,
    benefit,
    website,
    tone,
    ad_type,
    ad_count,
    generated_ads
  )
  VALUES (
    ${brandName},
    ${product},
    ${audience},
    ${benefit},
    ${website},
    ${tone},
    ${adType},
    ${totalAds},
    ${result}
  )
`;

console.log("Ad saved successfully!");

return Response.json(
  {
    result,
  },
  {
    status: 200,
  }
);
} catch (error: any) {
  return Response.json(
    {
      result: `Error generating ads: ${error?.message || "Unknown error"}`,
    },
    {
      status: 500,
    }
  );
}
}