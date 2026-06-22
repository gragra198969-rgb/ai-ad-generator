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

const ads = await sql`     SELECT *
    FROM ads
    ORDER BY id DESC
    LIMIT 50
  `;

return Response.json(ads);
}

export async function DELETE(req: Request) {
const { userId } = await auth();

if (!userId) {
return Response.json(
{ error: "Unauthorized" },
{ status: 401 }
);
}

const { searchParams } = new URL(req.url);
const id = searchParams.get("id");

if (!id) {
return Response.json(
{ error: "Missing ad id" },
{ status: 400 }
);
}

await sql`     DELETE FROM ads
    WHERE id = ${id}
  `;

return Response.json({
success: true,
});
}
