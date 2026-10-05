"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";

type Survey = { id: string; title: string; question: string; options: string[] };

export default function PublicSurveyPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answer, setAnswer] = useState("");
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/surveys/" + id, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "This survey is unavailable.");
        if (!cancelled) setSurvey(data.survey);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not open this survey.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!survey || sending) return;
    setError("");
    setSending(true);
    try {
      const response = await fetch("/api/surveys/" + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, comment, website }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your response.");
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your response.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f0f3e9] px-5 py-10 text-[#20231f] sm:py-16">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="flex w-fit items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#35563c] text-lg text-white">A</span>
          <span>adsurvey<span className="text-[#668154]">.studio</span></span>
        </a>
        <section className="mt-8 rounded-[2rem] border border-[#e7eae1] bg-white p-6 shadow-[0_25px_75px_-45px_rgba(43,61,39,.35)] sm:mt-12 sm:p-10">
          {loading ? <p className="py-8 text-center text-sm text-[#7b8076]">Opening your survey…</p>
            : submitted ? <div className="py-8 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e7ede1] text-2xl text-[#668154]">✓</span>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#2f3a2d]">Thank you for sharing.</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#777c72]">Your response has been sent to the business running this survey.</p>
            </div>
            : survey ? <>
              <p className="text-xs font-semibold uppercase tracking-[.15em] text-[#779067]">{survey.title}</p>
              <h1 className="mt-5 text-3xl font-semibold tracking-[-.04em] text-[#2f3a2d] sm:text-4xl">{survey.question}</h1>
              <p className="mt-3 text-sm text-[#7b8076]">Choose the answer that fits best. You can add a comment too.</p>
              <form onSubmit={submit} className="mt-7 space-y-5">
                <fieldset className="space-y-2.5">
                  <legend className="sr-only">Choose one answer</legend>
                  {survey.options.map((option) => (
                    <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 text-sm transition ${answer === option ? "border-[#91a982] bg-[#f4f7f0] text-[#506547]" : "border-[#e9ebe4] text-[#62685f] hover:border-[#becbb5]"}`}>
                      <input type="radio" name="answer" value={option} checked={answer === option} onChange={() => setAnswer(option)} required className="accent-[#668154]" />
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
                <div>
                  <label htmlFor="feedback-comment" className="text-sm font-semibold text-[#465242]">Anything else you’d like us to know? <span className="font-normal text-[#92978d]">(optional)</span></label>
                  <textarea id="feedback-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={4} placeholder="Share a little more…" className="mt-2 w-full resize-y rounded-xl border border-[#e3e6de] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#a1a69c] focus:border-[#8da27e] focus:ring-4 focus:ring-[#8da27e]/10" />
                  <p className="mt-1 text-right text-xs text-[#9a9f95]">{comment.length}/1000</p>
                </div>
                <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                  <label htmlFor="survey-website">Leave this field empty</label>
                  <input id="survey-website" name="website" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
                </div>
                <p className="text-xs leading-5 text-[#8b9086]">Your answer and optional comment are visible to the business that created this survey. Please don’t include sensitive or payment information.</p>
                {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
                <button type="submit" disabled={!answer || sending} className="w-full rounded-full bg-[#35563c] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#28452f] disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Sending…" : "Send feedback"}</button>
              </form>
            </> : <div className="py-8 text-center">
              <h1 className="text-2xl font-semibold text-[#2f3a2d]">Survey unavailable</h1>
              <p className="mt-3 text-sm text-[#7b8076]">{error || "This survey may have been removed."}</p>
              <a href="/" className="mt-6 inline-flex rounded-full border border-[#dfe3d9] px-5 py-2.5 text-sm font-semibold text-[#506547]">Back to AdSurvey Studio</a>
            </div>}
        </section>
        <p className="mt-5 text-center text-xs text-[#8b9086]">A thoughtful feedback loop · listen, learn, create</p>
      </div>
    </main>
  );
}
