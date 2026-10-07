import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { sql } from "@/app/lib/db";

import { allowRequest } from "@/app/lib/ad-security";
import { assertSameOrigin, readJsonObject, RequestError } from "@/app/lib/request-security";

export const maxDuration = 180;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Sign in to generate a picture." }, { status: 401 });
  }

  let input: Record<string, unknown>;
  try {
    assertSameOrigin(req);
    const body: unknown = await readJsonObject(req);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    input = body as Record<string, unknown>;
  } catch (error) {
    return Response.json({ error: error instanceof RequestError ? error.message : "Please provide valid product details." }, { status: error instanceof RequestError ? error.status : 400 });
  }

  const fields = ["product", "audience", "benefit", "brandName", "adType", "tone"] as const;
  const details: Record<string, string> = {};
  for (const field of fields) {
    const value = input[field];
    if (value !== undefined && typeof value !== "string") {
      return Response.json({ error: "Product details must be text." }, { status: 400 });
    }
    details[field] = typeof value === "string" ? value.trim() : "";
    if (details[field].length > 1000) {
      return Response.json({ error: "Keep each product detail under 1,000 characters." }, { status: 400 });
    }
  }
  if (!details.product || !details.audience) {
    return Response.json({ error: "Add a product and target audience first." }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "Picture generation is not configured yet." }, { status: 503 });
  }

  let reserved = false;
  try {
    if (!await allowRequest(userId, "generation", 5)) return Response.json({ error: "Please wait a minute before generating again." }, { status: 429, headers: { "Retry-After": "60" } });
    await sql`
      INSERT INTO users (clerk_user_id, ads_used, ads_limit)
      VALUES (${userId}, 0, 10)
      ON CONFLICT (clerk_user_id) DO NOTHING
    `;
    // Reserve atomically so simultaneous image requests cannot spend the same credit.
    const accounts = await sql`
      UPDATE users SET ads_used = ads_used + 1
      WHERE clerk_user_id = ${userId} AND ads_used < ads_limit
      RETURNING ads_used, ads_limit
    `;
    if (!accounts.length) {
      return Response.json({ error: "You have used all your available generations." }, { status: 403 });
    }
    reserved = true;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 150000,
      maxRetries: 0,
    });
    const response = await openai.images.generate({
      model: "gpt-image-1",
      size: "1024x1024",
      quality: "low",
      n: 1,
      prompt: `Create one square, photorealistic editorial advertising photo to use as the visual background for a separately typeset ad. This must look like a real camera photograph, not a poster, ad layout, social graphic, website mockup, collage, or product-package redesign.

Product or service to depict: ${details.product}
Audience and setting cues: ${details.audience}
Benefit or creative direction: ${details.benefit || "A natural, relatable product moment"}
Brand context for visual mood only (never draw or write the name): ${details.brandName || "none"}
Tone for lighting and color only: ${details.tone || "friendly"}

Build one believable everyday scene with a clear focal subject, natural light, authentic materials, realistic proportions, and grounded shadows. Use an editorial commercial-photo composition, restrained warm color, and natural detail. Keep the main subject near the center so the image still reads well when cropped. Leave the lower quarter visually calm for the app's separate headline overlay.

Absolutely no visible writing or typography: no words, letters, numbers, pseudo-text, logo, brand mark, watermark, caption, call-to-action, sign, label, or graphic overlay. Do not make a poster or any designed ad artwork. If a phone, monitor, or package appears, its screen or label must be blank and unbranded with no marks that resemble text. Do not invent product features, claims, or packaging. Avoid illustration, CGI, cartoon styling, plastic-looking surfaces, distorted hands, and excessive retouching.`,
    });
    const image = response.data?.[0]?.b64_json;
    if (!image) throw new Error("No image returned");

    return Response.json({ image: `data:image/png;base64,${image}` });
  } catch (error: unknown) {
    console.error("Picture generation failed:", error instanceof Error ? error.name : "Unknown error");
    if (reserved) {
      try {
        await sql`
          UPDATE users SET ads_used = GREATEST(0, ads_used - 1)
          WHERE clerk_user_id = ${userId}
        `;
      } catch {
        console.error("Picture credit refund failed");
        return Response.json({
          error: "Picture generation failed and we could not restore your credit. Please contact support.",
        }, { status: 500 });
      }
    }
    return Response.json({
      error: reserved
        ? "We couldn't generate that picture. Your credit was restored. Please try again."
        : "Picture generation is temporarily unavailable. Please try again.",
    }, { status: 502 });
  }
}
