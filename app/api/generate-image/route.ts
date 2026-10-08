import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { sql } from "@/app/lib/db";

import { allowRequest, ensureAdImageGenerationSlots } from "@/app/lib/ad-security";
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

  const adId = input.adId;
  const adIndex = input.adIndex;
  if (typeof adId !== "number" || !Number.isSafeInteger(adId) || adId < 1 ||
      typeof adIndex !== "number" || !Number.isInteger(adIndex) || adIndex < 0 || adIndex >= 20) {
    return Response.json({ error: "Create an ad idea first, then generate its image." }, { status: 400 });
  }

  const fields = ["product", "audience", "benefit", "brandName", "adType", "tone"] as const;
  const details: Record<string, string> = {};
  for (const field of fields) {
    const value = input[field];
    if (value !== undefined && typeof value !== "string") {
      return Response.json({ error: "Product details must be text." }, { status: 400 });
    }
    details[field] = typeof value === "string" ? value.trim() : "";
    const maxLength = field === "benefit" ? 3000 : 1000;
    if (details[field].length > maxLength) {
      return Response.json({ error: `Keep ${field === "benefit" ? "the ad direction" : "each product detail"} under ${maxLength.toLocaleString()} characters.` }, { status: 400 });
    }
  }
  if (!details.product || !details.audience) {
    return Response.json({ error: "Add a product and target audience first." }, { status: 400 });
  }
  let slotClaimed = false;
  let creditReserved = false;
  let freeImageClaimed = false;
  let imageRequestStarted = false;
  let isPro = false;
  try {
    await ensureAdImageGenerationSlots();
    await sql`
      INSERT INTO users (clerk_user_id, ads_used, ads_limit)
      VALUES (${userId}, 0, 10)
      ON CONFLICT (clerk_user_id) DO NOTHING
    `;

    const accounts = await sql`
      SELECT ads_used, ads_limit FROM users WHERE clerk_user_id = ${userId}
    `;
    if (!accounts.length) return Response.json({ error: "Account details could not be loaded. Please try again." }, { status: 503 });
    isPro = Number(accounts[0].ads_limit) > 10;
    if (isPro && Number(accounts[0].ads_used) >= Number(accounts[0].ads_limit)) {
      return Response.json({ error: "You have used all your Pro credits." }, { status: 403 });
    }

    if (!await allowRequest(userId, "image_generation", 5)) {
      return Response.json({ error: "Please wait a minute before creating another image." }, { status: 429, headers: { "Retry-After": "60" } });
    }

    const ads = await sql`
      SELECT id FROM ads
      WHERE id = ${adId} AND clerk_user_id = ${userId} AND ad_count > ${adIndex}
    `;
    if (!ads.length) {
      return Response.json({ error: "That ad could not be found in your account." }, { status: 404 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "Picture generation is not configured yet." }, { status: 503 });
    }

    const claimed = await sql`
      INSERT INTO ad_image_generation_slots (ad_id, ad_index, clerk_user_id, status)
      VALUES (${adId}, ${adIndex}, ${userId}, 'generating')
      ON CONFLICT (ad_id, ad_index) DO NOTHING
      RETURNING ad_id
    `;
    if (!claimed.length) {
      return Response.json({
        error: "This ad already used its one image request. Each ad can have one image, so another image won’t be generated or charged.",
        retryAllowed: false,
      }, { status: 409 });
    }
    slotClaimed = true;

    if (isPro) {
      const reserved = await sql`
        UPDATE users SET ads_used = ads_used + 1
        WHERE clerk_user_id = ${userId} AND ads_limit > 10 AND ads_used < ads_limit
        RETURNING ads_used
      `;
      if (!reserved.length) {
        await sql`DELETE FROM ad_image_generation_slots WHERE ad_id = ${adId} AND ad_index = ${adIndex} AND clerk_user_id = ${userId}`;
        slotClaimed = false;
        return Response.json({ error: "You have used all your Pro credits." }, { status: 403 });
      }
      creditReserved = true;
    } else {
      const freeClaim = await sql`
        INSERT INTO free_image_generation_claims (clerk_user_id, ad_id, ad_index, status)
        VALUES (${userId}, ${adId}, ${adIndex}, 'generating')
        ON CONFLICT (clerk_user_id) DO NOTHING
        RETURNING clerk_user_id
      `;
      if (!freeClaim.length) {
        await sql`DELETE FROM ad_image_generation_slots WHERE ad_id = ${adId} AND ad_index = ${adIndex} AND clerk_user_id = ${userId}`;
        slotClaimed = false;
        return Response.json({ error: "Your one free image has already been used. Pro includes 1 image credit for each ad." }, { status: 403 });
      }
      freeImageClaimed = true;
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 150000,
      maxRetries: 0,
    });
    imageRequestStarted = true;
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

    await sql`
      UPDATE ad_image_generation_slots SET status = 'generated'
      WHERE ad_id = ${adId} AND ad_index = ${adIndex} AND clerk_user_id = ${userId}
    `;
    if (freeImageClaimed) {
      await sql`UPDATE free_image_generation_claims SET status = 'generated' WHERE clerk_user_id = ${userId}`;
    }
    creditReserved = false;
    slotClaimed = false;
    return Response.json({ image: `data:image/png;base64,${image}` });
  } catch (error: unknown) {
    console.error("Picture generation failed:", error instanceof Error ? error.name : "Unknown error");
    let creditWasRefunded = false;
    if (creditReserved) {
      try {
        await sql`
          UPDATE users SET ads_used = GREATEST(0, ads_used - 1)
          WHERE clerk_user_id = ${userId}
        `;
        creditWasRefunded = true;
        creditReserved = false;
      } catch {
        console.error("Picture credit refund failed");
        return Response.json({
          error: "Picture generation failed and we could not restore your credit. Please contact support.",
          retryAllowed: false,
        }, { status: 500 });
      }
    }
    if (freeImageClaimed) {
      try {
        if (imageRequestStarted) {
          // An ambiguous provider result consumes the one free attempt to cap owner costs.
          await sql`UPDATE free_image_generation_claims SET status = 'failed' WHERE clerk_user_id = ${userId}`;
        } else {
          await sql`DELETE FROM free_image_generation_claims WHERE clerk_user_id = ${userId}`;
        }
      } catch {
        // Keep a claim if cleanup fails; allowing another attempt could incur another charge.
      }
    }
    if (slotClaimed) {
      try {
        if (imageRequestStarted) {
          // Keep the unique slot after an upstream attempt so a timeout or lost response
          // cannot trigger a second paid image request for the same ad.
          await sql`
            UPDATE ad_image_generation_slots SET status = 'failed'
            WHERE ad_id = ${adId} AND ad_index = ${adIndex} AND clerk_user_id = ${userId}
          `;
        } else {
          await sql`
            DELETE FROM ad_image_generation_slots
            WHERE ad_id = ${adId} AND ad_index = ${adIndex} AND clerk_user_id = ${userId}
          `;
        }
      } catch {
        // If cleanup fails, keeping the unique slot is safer than risking a duplicate API charge.
      }
    }
    return Response.json({
      error: imageRequestStarted
        ? isPro
          ? "The image request failed. Your credit was restored. To avoid a duplicate image charge, this ad’s image request is locked; create a new ad to try again."
          : "The image request failed after it started, so the free image was used to prevent a duplicate provider charge."
        : creditWasRefunded
          ? "Picture generation did not start. Your Pro credit was restored; you can try again."
          : "Picture generation is temporarily unavailable. Please try again.",
      retryAllowed: !imageRequestStarted,
    }, { status: 502 });
  }
}

