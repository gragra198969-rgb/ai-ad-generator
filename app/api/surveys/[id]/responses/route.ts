import { auth } from "@clerk/nextjs/server";
import { sql } from "@/app/lib/db";
import { ensureSurveySchema, isSurveyId } from "@/app/lib/survey-db";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isSurveyId(id)) return Response.json({ error: "Survey not found." }, { status: 404 });
  try {
    await ensureSurveySchema();
    const survey = await sql`SELECT id FROM customer_surveys WHERE id = ${id}::uuid AND owner_id = ${userId}`;
    if (!survey.length) return Response.json({ error: "Survey not found." }, { status: 404 });
    const responses = await sql`
      SELECT id, answer, comment, created_at
      FROM customer_survey_responses
      WHERE survey_id = ${id}::uuid
      ORDER BY created_at DESC
      LIMIT 100
    `;
    return Response.json({ responses }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load these responses." }, { status: 503 });
  }
}
