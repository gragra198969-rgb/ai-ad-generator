"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

type Survey = {
  id: string;
  title: string;
  question: string;
  options: string[];
  active: boolean;
  created_at: string;
  response_count: number;
};
type SurveyResponse = { id: number; answer: string; comment: string; created_at: string };

const frame = "mx-auto w-full max-w-6xl px-5 sm:px-8";

export default function SurveysDashboard() {
  const { isLoaded, isSignedIn } = useUser();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [question, setQuestion] = useState("What would make your next visit even better?");
  const [title, setTitle] = useState("Customer feedback");
  const [choices, setChoices] = useState("More options to choose from\nA smoother checkout\nHelpful tips along the way");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState("");
  const [responses, setResponses] = useState<Record<string, SurveyResponse[]>>({});
  const [loadingResponses, setLoadingResponses] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [visibleLinkId, setVisibleLinkId] = useState("");

  const loadSurveys = useCallback(async () => {
    const response = await fetch("/api/surveys", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load your surveys.");
    setSurveys(data.surveys);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLoading(false); return; }
    let cancelled = false;
    loadSurveys().catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load your surveys.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, loadSurveys]);

  async function createSurvey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const options = choices.split("\n").map((choice) => choice.trim()).filter(Boolean);
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, question, options }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create the survey.");
      await loadSurveys();
      setNotice("Survey created. Copy the link and share it with your customers.");
      setQuestion("");
      setTitle("Customer feedback");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the survey.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink(id: string) {
    const link = window.location.origin + "/survey/" + id;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setVisibleLinkId("");
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch {
      setVisibleLinkId(id);
      setNotice("Copy wasn’t available. Select the survey link shown on its card.");
    }
  }

  async function toggleResponses(survey: Survey) {
    if (openId === survey.id) { setOpenId(""); return; }
    setOpenId(survey.id);
    if (responses[survey.id]) return;
    setLoadingResponses(survey.id);
    try {
      const response = await fetch("/api/surveys/" + survey.id + "/responses", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load responses.");
      setResponses((current) => ({ ...current, [survey.id]: data.responses }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load responses.");
    } finally {
      setLoadingResponses("");
    }
  }

  async function deleteSurvey(id: string) {
    if (!window.confirm("Delete this survey and its saved responses? This cannot be undone.")) return;
    setError("");
    try {
      const response = await fetch("/api/surveys?id=" + encodeURIComponent(id), { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete this survey.");
      setSurveys((current) => current.filter((survey) => survey.id !== id));
      setNotice("Survey and its responses deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this survey.");
    }
  }

  if (!isLoaded || loading) return <main className="min-h-screen bg-[#fbfaf8] px-5 py-16 text-[#777c72]"><div className={frame}>Loading your surveys…</div></main>;

  if (!isSignedIn) return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] px-5 py-12 text-[#20231f]">
      <section className="w-full max-w-lg rounded-[1.75rem] border border-[#e8eae3] bg-white p-8 text-center shadow-xl shadow-[#35563c]/5">
        <a href="/" className="mx-auto flex w-fit items-center gap-3 font-semibold tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#35563c] text-lg text-white">A</span><span>adsurvey<span className="text-[#668154]">.studio</span></span></a>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">Private survey inbox</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to manage surveys.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#777c72]">Your surveys and customer responses are private to your workspace.</p>
        <SignInButton mode="modal"><button className="mt-7 w-full rounded-full bg-[#35563c] px-5 py-3.5 text-sm font-semibold text-white">Sign in</button></SignInButton>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-[#20231f]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#fbfaf8]/90 backdrop-blur-xl">
        <div className={frame + " flex h-[72px] items-center justify-between"}>
          <a href="/" className="flex items-center gap-3 font-semibold tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#35563c] text-lg text-white">A</span><span>adsurvey<span className="text-[#668154]">.studio</span></span></a>
          <nav className="flex items-center gap-3 sm:gap-6" aria-label="Workspace navigation">
            <a href="/dashboard" className="hidden text-sm font-medium text-[#687064] transition hover:text-[#35563c] sm:inline">Workspace</a>
            <a href="/#studio" className="hidden text-sm font-medium text-[#687064] transition hover:text-[#35563c] sm:inline">Ad studio</a>
            <UserButton />
          </nav>
        </div>
      </header>
      <div className={frame + " pb-20 pt-10 sm:pt-14"}>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">Customer feedback</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Surveys that listen.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#777c72]">Create a short survey, share its link, and collect choices and comments. Replies stay private to your workspace.</p>
          </div>
          <a href="/#surveys" className="text-sm font-semibold text-[#547249] hover:text-[#35563c]">About surveys ↗</a>
        </div>

        <div className="mt-9 grid items-start gap-7 lg:grid-cols-[.85fr_1.15fr]">
          <section className="rounded-[1.5rem] border border-[#e8eae3] bg-white p-6 shadow-sm sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-[#779067]">Create a survey</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Ask one useful question.</h2>
            <form onSubmit={createSurvey} className="mt-6 space-y-4">
              <div><label htmlFor="survey-title" className="text-sm font-medium text-[#475143]">Survey name</label><input id="survey-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} className="mt-1.5 w-full rounded-xl border border-[#e3e6de] px-3.5 py-3 text-sm outline-none focus:border-[#8da27e] focus:ring-4 focus:ring-[#8da27e]/10" /></div>
              <div><label htmlFor="survey-question" className="text-sm font-medium text-[#475143]">Question</label><textarea id="survey-question" value={question} onChange={(event) => setQuestion(event.target.value)} required maxLength={240} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-[#e3e6de] px-3.5 py-3 text-sm outline-none focus:border-[#8da27e] focus:ring-4 focus:ring-[#8da27e]/10" /></div>
              <div><label htmlFor="survey-choices" className="text-sm font-medium text-[#475143]">Answer choices <span className="font-normal text-[#858a80]">(one per line, 2–5)</span></label><textarea id="survey-choices" value={choices} onChange={(event) => setChoices(event.target.value)} required rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-[#e3e6de] px-3.5 py-3 text-sm leading-6 outline-none focus:border-[#8da27e] focus:ring-4 focus:ring-[#8da27e]/10" /></div>
              {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              {notice && <p role="status" className="rounded-xl bg-[#f0f4eb] px-4 py-3 text-sm text-[#52664a]">{notice}</p>}
              <button type="submit" disabled={saving} className="w-full rounded-full bg-[#35563c] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#28452f] disabled:opacity-60">{saving ? "Creating…" : "Create survey"}</button>
              <p className="text-xs leading-5 text-[#92978d]">Customers don’t need an account. Ask them not to include sensitive details in comments.</p>
            </form>
          </section>

          <section>
            <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#779067]">Your surveys</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Response inbox</h2></div><span className="rounded-full bg-[#e7ede1] px-3 py-1.5 text-xs font-semibold text-[#52664a]">{surveys.length} {surveys.length === 1 ? "survey" : "surveys"}</span></div>
            {surveys.length === 0 ? <div className="mt-5 rounded-[1.5rem] border border-dashed border-[#d9dfd2] bg-white/60 px-6 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7ede1] text-xl text-[#668154]">✳</div><h3 className="mt-4 font-semibold text-[#465242]">Your inbox starts with one question.</h3><p className="mt-2 text-sm leading-6 text-[#858a80]">Create a survey, share its link, and customer responses will appear here.</p></div>
              : <div className="mt-5 space-y-4">{surveys.map((survey) => (
                <article key={survey.id} className="rounded-[1.5rem] border border-[#e8eae3] bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[#829478]">{survey.title}</p><h3 className="mt-2 text-lg font-semibold leading-6 text-[#2f3a2d]">{survey.question}</h3><p className="mt-2 text-xs text-[#92978d]">{new Date(survey.created_at).toLocaleDateString()} · {survey.response_count} {survey.response_count === 1 ? "response" : "responses"}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => copyLink(survey.id)} className="rounded-full bg-[#35563c] px-3.5 py-2 text-xs font-semibold text-white">{copiedId === survey.id ? "Link copied" : "Copy link"}</button>
                      <button type="button" onClick={() => toggleResponses(survey)} className="rounded-full border border-[#dfe3d9] px-3.5 py-2 text-xs font-semibold text-[#52664a]">{openId === survey.id ? "Hide replies" : "View replies"}</button>
                      <button type="button" onClick={() => deleteSurvey(survey.id)} className="rounded-full border border-[#eadbd8] px-3.5 py-2 text-xs font-semibold text-[#8a5149]">Delete</button>
                    </div>
                  </div>
                  {visibleLinkId === survey.id && <p className="mt-4 break-all rounded-xl bg-[#f4f6f1] p-3 text-xs text-[#52664a]">https://{window.location.host}/survey/{survey.id}</p>}
                  {openId === survey.id && <div className="mt-5 border-t border-[#edf0e8] pt-4">
                    {loadingResponses === survey.id ? <p className="text-sm text-[#858a80]">Loading replies…</p>
                      : !responses[survey.id]?.length ? <p className="text-sm text-[#858a80]">No responses yet. Share your survey link to start collecting feedback.</p>
                        : <div className="space-y-3">{responses[survey.id].map((response) => <div key={response.id} className="rounded-xl bg-[#f7f8f4] p-4"><p className="text-xs font-semibold text-[#74856a]">{response.answer}</p>{response.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4e564a]">{response.comment}</p>}<p className="mt-3 text-[11px] text-[#969b91]">{new Date(response.created_at).toLocaleString()}</p></div>)}</div>}
                  </div>}
                </article>
              ))}</div>}
            <p className="mt-4 text-xs leading-5 text-[#92978d]">Customer replies are private to you. Email alerts are not enabled because this app has no email sender configured.</p>
          </section>
        </div>
        <footer className="mt-16 flex flex-col gap-4 border-t border-black/5 pt-6 text-xs text-[#8a9083] sm:flex-row sm:items-center sm:justify-between"><a href="/" className="font-semibold text-[#45543f]">adsurvey<span className="text-[#668154]">.studio</span></a><div className="flex flex-wrap gap-x-5 gap-y-2"><a href="/privacy" className="hover:text-[#35563c]">Privacy</a><a href="/terms" className="hover:text-[#35563c]">Terms</a></div><a href="/#surveys" className="hover:text-[#35563c]">Back to surveys ↗</a></footer>
      </div>
    </main>
  );
}
