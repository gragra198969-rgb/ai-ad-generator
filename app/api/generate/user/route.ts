import { auth } from "@clerk/nextjs/server";
import { sql } from "@/app/lib/db";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const users = await sql`
    SELECT ads_used, ads_limit
    FROM users
    WHERE clerk_user_id = ${userId}
  `;

  if (!users.length) {
    return Response.json({
      ads_used: 0,
      ads_limit: 50,
    });
  }

  return Response.json(users[0]);
}