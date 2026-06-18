import OpenAI from "openai";

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
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
if (!product || !audience || !website) {
  return Response.json(
    {
      result: "Product name, audience, and website are required.",
    },
    {
      status: 400,
    }
  );
}

const prompt = `


You are an elite direct-response copywriter.

Create ${adCount} highly persuasive ${adType} advertisements.

PRODUCT INFORMATION

Brand Name:
${brandName}

Product Name:
${product}

Target Audience:
${audience}

Primary Benefit:
${benefit}

Website:
${website}

Tone:
${tone}


PRODUCT RULES

- The brand name is "${brandName}"
- Use the brand name naturally throughout the advertisements.
- Combine the brand name and product category when appropriate.

If the product name is generic
(examples: Dog Food, Coffee, Protein Powder, Shoes),
treat it as a category rather than a branded product.

Create a unique identity around "${brandName}".

Prefer using "${brandName}" in headlines.

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

COMPLIANCE RULES

- Do not invent statistics
- Do not invent customer counts
- Do not invent testimonials
- Do not invent reviews
- Do not imply popularity unless explicitly provided
- Do not claim veterinary approval unless provided
- Do not make medical claims
- Use persuasive marketing language without fabricated facts

COPYWRITING RULES

- Write like a professional marketer
- Use emotional triggers
- Focus on benefits and outcomes
- Use curiosity and urgency
- Create unique angles for every ad
- Use persuasive language without invented social proof
- Ready for real-world advertising campaigns

OUTPUT RULES

- Use the exact website URL provided
- Include this URL in every CTA: ${website}
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

Generate exactly ${adCount} advertisements.

Return only the advertisements..
`;

console.log({
product,
audience,
benefit,
website,
tone,
adType,
});
const response = await openai.chat.completions.create({
  model: "gpt-4.1-mini",
  messages: [
    {
      role: "user",
      content: prompt,
    },
  ],
  temperature: 0.8,
});

const result =
  response.choices[0]?.message?.content ||
  "No ad generated.";

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