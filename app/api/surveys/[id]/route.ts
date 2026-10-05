import { sql } from "@/app/lib/db";
import { assertSameOrigin, readJsonObject, RequestError, textField } from "@/app/lib/request-security";
import { ensureSurveySchema, isSurveyId, surveyOptions } from "@/app/lib/survey-db";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  const { id } = await params;
  if (!isSurveyId(id)) return Response.json({ error: "Survey not found." }, { status: 404 });
  try {
    await ensureSurveySchema();
    const rows = await sql`
      SELECT id, title, question, options
      FROM customer_surveys
      WHERE id = ${id}::uuid AND active = TRUE
    `;
    if (!rows.length) return Response.json({ error: "Survey not found." }, { status: 404 });
    return Response.json({
      survey: { ...rows[0], options: surveyOptions(rows[0].options) },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not open this survey." }, { status: 503 });
  }
}

export async function POST(req: Request, { params }: Context) {
  const { id } = await params;
  if (!isSurveyId(id)) return Response.json({ error: "Survey not found." }, { status: 404 });
  try {
    assertSameOrigin(req);
    if (!req.headers.get("origin")) throw new RequestError("Open the survey link in a browser.", 403);
    const input = await readJsonObject(req, 4096);
    const honeypot = textField(input, "website", 200);
    if (honeypot) return Response.json({ success: true }, { status: 201 });
    const answer = textField(input, "answer", 100);
    const comment = textField(input, "comment", 1000);
    if (!answer) throw new RequestError("Choose an answer before submitting.");
    await ensureSurveySchema();
    const surveys = await sql`
      SELECT options FROM customer_surveys WHERE id = ${id}::uuid AND active = TRUE
    `;
    if (!surveys.length) return Response.json({ error: "Survey not found." }, { status: 404 });
    const options = surveyOptions(surveys[0].options);
    if (!options.includes(answer)) throw new RequestError("Choose one of the listed answers.");
    const rows = await sql`
      INSERT INTO customer_survey_responses (survey_id, answer, comment)
      SELECT id, ${answer}, ${comment}
      FROM customer_surveys WHERE id = ${id}::uuid AND active = TRUE
      RETURNING id
    `;
    if (!rows.length) return Response.json({ error: "Survey not found." }, { status: 404 });
    return Response.json({ success: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: error instanceof RequestError ? error.message : "Could not save your response.",
    }, { status: error instanceof RequestError ? error.status : 503 });
  }
}
