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
    } = await req.json();

    const prompt = `
Create a professional Facebook advertisement image.

Product: ${product}
Audience: ${audience}
Benefit: ${benefit}

Style:
- Modern marketing design
- High converting social media advertisement
- Bright colors
- Professional quality
- Product focused
- No watermarks
`;

    const image = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    return Response.json({
  image: `data:image/png;base64,${image.data?.[0]?.b64_json}`,
});
  } catch (error: any) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}