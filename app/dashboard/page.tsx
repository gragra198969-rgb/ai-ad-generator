"use client";

import { useEffect, useMemo, useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

type SavedAd = {
  id: number;
  brand_name?: string;
  product?: string;
  audience?: string;
  ad_type?: string;
  created_at: string | Date;
  generated_ads?: string;
};

type CreditUsage = {
  used: number;
  limit: number;
};

type SavedIdea = { number: string; headline: string; body: string; cta: string };

function parseSavedIdeas(raw?: string): SavedIdea[] {
  if (!raw) return [];
  const chunks = raw.split(/(?=AD\s*#\s*\d+)/i).filter((chunk) => /AD\s*#\s*\d+/i.test(chunk));
  return chunks.map((chunk, index) => {
    const number = chunk.match(/AD\s*#\s*(\d+)/i)?.[1] || String(index + 1);
    const headline = chunk.match(/Headline:\s*([\s\S]*?)(?=\n\s*Body Copy:|$)/i)?.[1]?.trim() || "";
    const body = chunk.match(/Body Copy:\s*([\s\S]*?)(?=\n\s*(?:Call To Action|CTA):|$)/i)?.[1]?.trim() || "";
    const cta = chunk.match(/(?:Call To Action|CTA):\s*([\s\S]*?)\s*$/i)?.[1]?.trim() || "";
    return { number, headline, body, cta };
  }).filter((idea) => idea.headline || idea.body || idea.cta);
}

export default function Dashboard() {
  const { isLoaded, isSignedIn } = useUser();
  const [savedAds, setSavedAds] = useState<SavedAd[]>([]);
  const [usage, setUsage] = useState<CreditUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditsError, setCreditsError] = useState("");
  const [adsError, setAdsError] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setCreditsError("");
      setAdsError("");

      try {
        const [userRes, adsRes] = await Promise.all([
          fetch("/api/user"),
          fetch("/api/ads"),
        ]);

        if (cancelled) return;

        if (userRes.ok) {
          const userData = await userRes.json();
          const limit = Math.max(0, Number(userData.ads_limit) || 0);
          const used = Math.max(0, Number(userData.ads_used) || 0);
          setUsage({ used, limit });
        } else {
          setCreditsError("We couldn’t load your credit balance. Please refresh to try again.");
        }

        if (adsRes.ok) {
          const adsData = await adsRes.json();
          setSavedAds(Array.isArray(adsData) ? adsData : []);
        } else {
          setAdsError("Your saved campaigns couldn’t be loaded. Please refresh to try again.");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setCreditsError("We couldn’t load your credit balance. Please refresh to try again.");
          setAdsError("Your saved campaigns couldn’t be loaded. Please refresh to try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const creditsLeft = usage ? Math.max(0, usage.limit - usage.used) : null;
  const usagePercent = usage && usage.limit > 0
    ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
    : 0;
  const isPro = (usage?.limit ?? 0) > 10;

  const filteredAds = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return savedAds;

    return savedAds.filter((ad) =>
      [ad.brand_name, ad.product, ad.audience]
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [savedAds, search]);

  async function deleteAd(id: number) {
    if (!confirm("Delete this saved campaign? This can’t be undone.")) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/ads?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete request failed");
      setSavedAds((current) => current.filter((ad) => ad.id !== id));
    } catch (error) {
      console.error(error);
      alert("We couldn’t delete that campaign. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const frame = "mx-auto w-full max-w-7xl px-5 sm:px-8";

  if (!isLoaded || loading) {
    return (
      <main className="min-h-screen bg-[#fbfaf8] text-[#20231f]">
        <header className="border-b border-black/5 bg-white/70">
          <div className={`${frame} flex h-[72px] items-center`}>
            <a href="/" className="flex items-center gap-3 font-semibold tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#35563c] text-lg text-white">A</span>
              <span>adsurvey<span className="text-[#668154]">.studio</span></span>
            </a>
          </div>
        </header>
        <div className={`${frame} py-12`}>
          <div className="h-5 w-32 animate-pulse rounded-full bg-[#e9eee2]" />
          <div className="mt-4 h-10 w-72 max-w-full animate-pulse rounded-xl bg-[#e9eee2]" />
          <div className="mt-9 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            <div className="h-64 animate-pulse rounded-[1.5rem] bg-[#e9eee2]" />
            <div className="h-64 animate-pulse rounded-[1.5rem] bg-white" />
          </div>
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] px-5 py-12 text-[#20231f]">
        <section className="w-full max-w-lg rounded-[1.75rem] border border-[#e8eae3] bg-white p-8 text-center shadow-xl shadow-[#35563c]/5 sm:p-10">
          <a href="/" className="mx-auto flex w-fit items-center gap-3 font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#35563c] text-lg text-white">A</span>
            <span>adsurvey<span className="text-[#668154]">.studio</span></span>
          </a>
          <div className="mx-auto mt-9 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f2f4e9] text-2xl text-[#668154]">✳</div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">Your workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Your credits live here.</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#777c72]">Sign in to see your remaining generations and saved campaigns.</p>
          <SignInButton mode="modal">
            <button className="mt-7 w-full rounded-full bg-[#35563c] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#28452f]">Sign in to your workspace</button>
          </SignInButton>
          <a href="/#pricing" className="mt-4 inline-flex text-sm font-medium text-[#5c7252] hover:text-[#35563c]">View plans and pricing ↗</a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-[#20231f]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#fbfaf8]/90 backdrop-blur-xl">
        <div className={`${frame} flex h-[72px] items-center justify-between`}>
          <a href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#35563c] text-lg text-white">A</span>
            <span>adsurvey<span className="text-[#668154]">.studio</span></span>
          </a>
          <nav className="flex items-center gap-3 sm:gap-6" aria-label="Workspace navigation">
            <a href="/#studio" className="hidden text-sm font-medium text-[#687064] transition hover:text-[#35563c] sm:inline">Ad studio</a>
            <a href="/dashboard/surveys" className="hidden text-sm font-medium text-[#687064] transition hover:text-[#35563c] md:inline">Surveys</a>
            <a href="/#pricing" className="hidden text-sm font-medium text-[#687064] transition hover:text-[#35563c] sm:inline">Plans</a>
            <a href="/#studio" className="rounded-full bg-[#35563c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28452f]">Create ideas <span aria-hidden="true">↗</span></a>
            <UserButton />
          </nav>
        </div>
      </header>

      <div className={`${frame} pb-20 pt-10 sm:pt-14`}>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">Your workspace</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">Credits & campaigns</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#777c72]">Keep an eye on your creative room and pick up where your last idea left off.</p>
          </div>
          <a href="/#studio" className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dfe3d9] bg-white px-4 py-2.5 text-sm font-semibold text-[#506547] transition hover:bg-[#f7f8f4]">Go to ad studio <span aria-hidden="true">↗</span></a>
        </div>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]" aria-label="Credit balance and plan">
          <article className="relative isolate overflow-hidden rounded-[1.6rem] bg-[#35563c] p-6 text-white shadow-xl shadow-[#35563c]/10 sm:p-8">
            <div aria-hidden="true" className="absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-full border-[36px] border-white/[.06]" />
            <div aria-hidden="true" className="absolute -bottom-24 right-24 -z-10 h-48 w-48 rounded-full bg-white/[.04] blur-2xl" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[.16em] text-white/65">Available generations</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">{isPro ? "Pro plan" : "Free plan"}</span>
            </div>
            <div className="mt-7 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="text-6xl font-semibold leading-none tracking-[-.07em] sm:text-7xl">{creditsError ? "—" : creditsLeft ?? "—"}</span>
              <span className="pb-1 text-sm text-white/65">of {usage?.limit ?? "—"} credits</span>
            </div>
            <p className="mt-3 text-sm text-white/75">{isPro ? "Your Pro generations renew each month." : "Your free generations are ready when you are."}</p>
            <div className="mt-8">
              <div className="mb-2 flex justify-between text-xs text-white/65"><span>Used</span><span>{usage ? `${usage.used} of ${usage.limit}` : "Balance unavailable"}</span></div>
              <div
                className="h-2 overflow-hidden rounded-full bg-white/15"
                role="progressbar"
                aria-label="Generations used"
                aria-valuemin={0}
                aria-valuemax={usage?.limit ?? 100}
                aria-valuenow={usage ? Math.min(usage.used, usage.limit) : 0}
              >
                <div className="h-full rounded-full bg-[#d7e5c9] transition-all" style={{ width: `${usage ? usagePercent : 0}%` }} />
              </div>
            </div>
            {creditsError && <p role="status" className="mt-4 text-sm text-white/80">{creditsError}</p>}
          </article>

          <article className="flex flex-col justify-between rounded-[1.6rem] border border-[#e8eae3] bg-white p-6 shadow-sm shadow-black/[.02] sm:p-8">
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[.16em] text-[#779067]">Your plan</span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isPro ? "bg-[#edf2e8] text-[#496442]" : "bg-[#f4f3ef] text-[#777c72]"}`}>{isPro ? "Active" : "A lovely place to start"}</span>
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-.045em]">{isPro ? "Pro" : "Free"}</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#777c72]">{isPro ? "Get 150 monthly credits for ad generations or images." : "Start with 10 credits. Upgrade when you need more monthly room."}</p>
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#f7f8f4] p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg text-[#668154] shadow-sm">✳</span>
                <div><p className="text-sm font-semibold text-[#394736]">One generation or image, one credit</p><p className="mt-0.5 text-xs leading-5 text-[#7b8076]">Your balance covers ad batches and generated images.</p></div>
              </div>
            </div>
            <a href="/#pricing" className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${isPro ? "border border-[#dfe3d9] text-[#506547] hover:bg-[#f7f8f4]" : "bg-[#35563c] text-white hover:bg-[#28452f]"}`}>
              {isPro ? "Review plan details" : "See Pro plan · $9.99/month"} <span aria-hidden="true">↗</span>
            </a>
          </article>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <article className="rounded-[1.25rem] border border-[#e8eae3] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a9083]">Available</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-.05em]">{creditsError ? "—" : creditsLeft ?? "—"}</p>
            <p className="mt-1 text-xs text-[#858a80]">generations to create</p>
          </article>
          <article className="rounded-[1.25rem] border border-[#e8eae3] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a9083]">Used</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-.05em]">{usage?.used ?? "—"}</p>
            <p className="mt-1 text-xs text-[#858a80]">of {usage?.limit ?? "—"} total credits</p>
          </article>
          <article className="rounded-[1.25rem] border border-[#e8eae3] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a9083]">Saved campaigns</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-.05em]">{savedAds.length}</p>
            <p className="mt-1 text-xs text-[#858a80]">ideas kept in your workspace</p>
          </article>
        </div>

        <section className="mt-14" aria-labelledby="saved-campaigns-heading">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">Your creative library</p>
              <h2 id="saved-campaigns-heading" className="mt-3 text-3xl font-semibold tracking-[-.045em]">Saved campaigns</h2>
              <p className="mt-2 text-sm text-[#777c72]">The ideas you’ve saved, all in one place.</p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <span className="sr-only">Search saved campaigns</span>
              <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8a9083]">⌕</span>
              <input
                type="search"
                placeholder="Search campaigns..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-full border border-[#e3e6de] bg-white py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-[#9a9e92] focus:border-[#9aaf8d] focus:ring-4 focus:ring-[#35563c]/[.07]"
              />
            </label>
          </div>

          {adsError && <p role="status" className="mt-6 rounded-2xl border border-[#eadfcf] bg-[#fbf6ed] px-5 py-4 text-sm text-[#78674c]">{adsError}</p>}

          {savedAds.length === 0 && !adsError ? (
            <div className="mt-7 rounded-[1.5rem] border border-dashed border-[#dfe3d9] bg-white/70 px-6 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f4e9] text-xl text-[#668154]">✳</span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">Your next campaign starts with an idea.</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#777c72]">Create a few directions in the ad studio and save the ones you want to come back to.</p>
              <a href="/#studio" className="mt-6 inline-flex rounded-full bg-[#35563c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#28452f]">Create ad ideas ↗</a>
            </div>
          ) : filteredAds.length === 0 && !adsError ? (
            <div className="mt-7 rounded-[1.5rem] border border-[#e8eae3] bg-white px-6 py-10 text-center text-sm text-[#777c72]">No saved campaigns match “{search}”.</div>
          ) : (
            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAds.map((ad) => {
                const date = new Date(ad.created_at);
                const dateLabel = Number.isNaN(date.getTime()) ? "Saved campaign" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                const adIdeas = parseSavedIdeas(ad.generated_ads);

                return (
                  <article key={ad.id} className="flex min-w-0 flex-col rounded-[1.4rem] border border-[#e8eae3] bg-white p-5 shadow-sm shadow-black/[.02] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#35563c]/[.06]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#92988c]">{dateLabel}</p>
                        <h3 className="mt-2 truncate text-lg font-semibold tracking-tight text-[#30392e]">{ad.brand_name || ad.product || "Untitled campaign"}</h3>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f2f4e9] text-[#668154]">✳</span>
                    </div>
                    <div className="mt-5 space-y-3 text-sm">
                      {ad.product && <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#9a9e92]">Product</p><p className="mt-1 truncate text-[#5e6559]">{ad.product}</p></div>}
                      {ad.audience && <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#9a9e92]">Audience</p><p className="mt-1 line-clamp-2 text-[#5e6559]">{ad.audience}</p></div>}
                    </div>
                    <div className="mt-auto pt-5">
                      {ad.generated_ads && (
                        <details className="group overflow-hidden rounded-[1.25rem] border border-[#e4e9df] bg-white">
                          <summary className="cursor-pointer list-none px-4 py-3.5 marker:hidden">
                            <span className="flex items-center justify-between gap-3">
                              <span><span className="block text-sm font-semibold text-[#40513a]">View ad previews</span><span className="mt-0.5 block text-xs font-normal text-[#8b9285]">{adIdeas.length || "Campaign"} {adIdeas.length === 1 ? "idea" : "ideas"} · copy and call to action</span></span>
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0f4ec] text-[#607458] transition group-open:rotate-180" aria-hidden="true">⌄</span>
                            </span>
                          </summary>
                          <div className="max-h-[34rem] space-y-3 overflow-auto border-t border-[#edf0e9] bg-[#fafbf8] p-3">
                            {adIdeas.length > 0 ? adIdeas.map((idea, index) => (
                              <article key={index} className="overflow-hidden rounded-[1.1rem] border border-[#e7ebe2] bg-white shadow-sm">
                                <div className="bg-gradient-to-r from-[#35563c] via-[#49694b] to-[#819575] px-4 py-4 text-white">
                                  <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/75">Ad idea {idea.number || index + 1}</span><span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-medium">{ad.ad_type || "Campaign"} preview</span></div>
                                  <h4 className="mt-3 text-lg font-semibold leading-snug tracking-tight sm:text-xl">{idea.headline || "Campaign idea"}</h4>
                                </div>
                                <div className="p-4 sm:p-5">
                                  <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#92998d]">Primary message</p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#535d4e]">{idea.body || "Review the saved campaign copy in the original project."}</p>
                                  {idea.cta && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0e9] pt-3"><span className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#92998d]">Call to action</span><span className="rounded-full bg-[#edf2e9] px-3.5 py-2 text-xs font-semibold text-[#405b3c]">{idea.cta}</span></div>}
                                </div>
                              </article>
                            )) : <pre className="whitespace-pre-wrap break-words p-3 text-xs leading-5 text-[#656b60]">{ad.generated_ads}</pre>}
                          </div>
                        </details>
                      )}
                      <button
                        type="button"
                        disabled={deletingId === ad.id}
                        onClick={() => void deleteAd(ad.id)}
                        className="mt-3 w-full rounded-full border border-[#ece7e3] px-4 py-2.5 text-sm font-medium text-[#8a6259] transition hover:border-[#dfc7c0] hover:bg-[#fbf6f4] disabled:cursor-wait disabled:opacity-50"
                      >
                        {deletingId === ad.id ? "Removing…" : "Remove campaign"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-16 flex flex-col gap-4 border-t border-black/5 pt-6 text-xs text-[#8a9083] sm:flex-row sm:items-center sm:justify-between">
          <a href="/" className="font-semibold text-[#45543f]">adsurvey<span className="text-[#668154]">.studio</span></a>
          <div className="flex flex-wrap gap-x-5 gap-y-2"><a href="/privacy" className="hover:text-[#35563c]">Privacy</a><a href="/terms" className="hover:text-[#35563c]">Terms</a><a href="/faq" className="hover:text-[#35563c]">FAQ</a></div>
          <a href="/#pricing" className="hover:text-[#35563c]">Plan details ↗</a>
        </footer>
      </div>
    </main>
  );
}

