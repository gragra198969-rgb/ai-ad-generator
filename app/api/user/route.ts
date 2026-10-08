import { auth } from "@clerk/nextjs/server";
import { sql } from "@/app/lib/db";
import { ensureAdImageGenerationSlots } from "@/app/lib/ad-security";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  await ensureAdImageGenerationSlots();

  const users = await sql`
    SELECT COALESCE((SELECT ads_used FROM users WHERE clerk_user_id = ${userId}), 0) AS ads_used,
           COALESCE((SELECT ads_limit FROM users WHERE clerk_user_id = ${userId}), 10) AS ads_limit,
           NOT EXISTS (
             SELECT 1 FROM free_image_generation_claims WHERE clerk_user_id = ${userId}
           ) AS free_image_available
  `;

  return Response.json(users[0], { headers: { "Cache-Control": "private, no-store" } });
}

