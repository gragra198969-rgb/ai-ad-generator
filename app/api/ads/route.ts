import { auth } from "@clerk/nextjs/server";
import { sql } from "@/app/lib/db";
import { ensureAdImageGenerationSlots, ensureAdOwnership } from "@/app/lib/ad-security";
import { assertSameOrigin, RequestError } from "@/app/lib/request-security";

async function ensureProjectFields() {
  await ensureAdOwnership();
  await ensureAdImageGenerationSlots();
  await sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS project_name TEXT`;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureProjectFields();
    const ads = await sql`
      SELECT id, project_name, brand_name, product, audience, benefit, website, tone,
             ad_type, ad_count, generated_ads, created_at,
             COALESCE((
               SELECT ARRAY_AGG(slot.ad_index ORDER BY slot.ad_index)
               FROM ad_image_generation_slots AS slot
               WHERE slot.ad_id = ads.id AND slot.clerk_user_id = ${userId}
               AND slot.status IN ('generating', 'failed')
             ), ARRAY[]::INTEGER[]) AS image_locked_indices
      FROM ads WHERE clerk_user_id = ${userId} ORDER BY id DESC LIMIT 50
    `;
    return Response.json(ads, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Saved ads are temporarily unavailable." }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertSameOrigin(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
      return Response.json({ error: "Invalid ad id." }, { status: 400 });
    }
    await ensureAdOwnership();
    const deleted = await sql`DELETE FROM ads WHERE id = ${id} AND clerk_user_id = ${userId} RETURNING id`;
    if (!deleted.length) return Response.json({ error: "Ad not found." }, { status: 404 });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error instanceof RequestError ? error.message : "Could not delete this ad." },
      { status: error instanceof RequestError ? error.status : 503 });
  }
}

