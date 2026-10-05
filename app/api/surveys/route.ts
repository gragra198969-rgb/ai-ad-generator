import { auth } from "@clerk/nextjs/server";
import { sql } from "@/app/lib/db";
import { allowRequest } from "@/app/lib/ad-security";
import { assertSameOrigin, readJsonObject, RequestError, textField } from "@/app/lib/request-security";
import { ensureSurveySchema, isSurveyId, surveyOptions } from "@/app/lib/survey-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureSurveySchema();
    const surveys = await sql`
      SELECT s.id, s.title, s.question, s.options, s.active, s.created_at,
        COUNT(r.id)::int AS response_count
      FROM customer_surveys s
      LEFT JOIN customer_survey_responses r ON r.survey_id = s.id
      WHERE s.owner_id = ${userId}
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;
    return Response.json({ surveys: surveys.map((survey) => ({
      ...survey,
      options: surveyOptions(survey.options),
      response_count: Number(survey.response_count || 0),
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load your surveys." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertSameOrigin(req);
    if (!await allowRequest(userId, "create_survey", 10)) {
      throw new RequestError("Please wait a moment before creating another survey.", 429);
    }
    const input = await readJsonObject(req, 8192);
    const title = textField(input, "title", 80) || "Customer feedback";
    const question = textField(input, "question", 240);
    if (!question) throw new RequestError("Add a survey question.");
    if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 5
      || input.options.some((item) => typeof item !== "string" || item.trim().length > 100)) {
      throw new RequestError("Add 2 to 5 answer choices, each up to 100 characters.");
    }
    const options = [...new Map((input.options as string[])
      .map((item) => item.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .map((item) => [item.toLowerCase(), item])).values()];
    if (options.length < 2) throw new RequestError("Add at least two different answer choices.");
    await ensureSurveySchema();
    const rows = await sql`
      INSERT INTO customer_surveys (owner_id, title, question, options)
      VALUES (${userId}, ${title}, ${question}, ${JSON.stringify(options)}::jsonb)
      RETURNING id, title, question, options, active, created_at
    `;
    return Response.json({ survey: { ...rows[0], options: surveyOptions(rows[0].options), response_count: 0 } }, { status: 201 });
  } catch (error) {
    return Response.json({
      error: error instanceof RequestError ? error.message : "Could not create your survey.",
    }, { status: error instanceof RequestError ? error.status : 503 });
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertSameOrigin(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!isSurveyId(id)) throw new RequestError("Invalid survey id.");
    await ensureSurveySchema();
    const rows = await sql`DELETE FROM customer_surveys WHERE id = ${id}::uuid AND owner_id = ${userId} RETURNING id`;
    if (!rows.length) return Response.json({ error: "Survey not found." }, { status: 404 });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({
      error: error instanceof RequestError ? error.message : "Could not delete this survey.",
    }, { status: error instanceof RequestError ? error.status : 503 });
  }
}
