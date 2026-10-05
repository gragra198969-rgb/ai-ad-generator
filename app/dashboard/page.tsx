"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";

type SavedAd = {
  id: number;
  brand_name?: string | null;
  product?: string | null;
  audience?: string | null;
  created_at: string | Date;
  generated_ads?: string | null;
};

type Balance = {
  used: number;
  limit: number;
};

export default function Dashboard() {
  const { isLoaded, isSignedIn } = useUser();
  const [savedAds, setSavedAds] = useState<SavedAd[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadDashboard() {
      setLoading(true);
      setLoadError("");
      try {
        const [userResponse, adsResponse] = await Promise.all([
          fetch("/api/user", { cache: "no-store" }),
          fetch("/api/ads", { cache: "no-store" }),
        ]);
        if (!userResponse.ok || !adsResponse.ok) {
          throw new Error("We couldn’t load your workspace. Please refresh and try again.");
        }

        const userData = await userResponse.json();
        const adsData = await adsResponse.json();
        if (cancelled) return;
        const used = Number(userData.ads_used);
        const limit = Number(userData.ads_limit);
        setBalance({
          used: Number.isFinite(used) ? Math.max(0, used) : 0,
          limit: Number.isFinite(limit) ? Math.max(0, limit) : 0,
        });
        setSavedAds(Array.isArray(adsData) ? adsData : []);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "We couldn’t load your workspace.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  const filteredAds = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return savedAds;
    return savedAds.filter((ad) =>
      [ad.brand_name, ad.product, ad.audience]
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }, [savedAds, search]);

  async function deleteAd(id: number) {
    if (!window.confirm("Delete this saved campaign permanently?")) return;
    setDeletingId(id);
    setLoadError("");
    try {
      const response = await fetch(`/api/ads?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("This campaign couldn’t be deleted. Please try again.");
      setSavedAds((ads) => ads.filter((ad) => ad.id !== id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "This campaign couldn’t be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  const isPro = (balance?.limit ?? 0) > 10;
  const creditsLeft = balance ? Math.max(0, balance.limit - balance.used) : null;
  const usagePercent = balance && balance.limit > 0
    ? Math.min(100, Math.round((balance.used / balance.limit) * 100))
    : 0;

  if (!isLoaded || (loading && isSignedIn)) {
    return (
      <main className="min-h-screen bg-[#f7f8f4] px-5 py-10 text-[#2b3729] sm:px-8">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-5 w-40 rounded-full bg-[#e8ebe3]" />
          <div className="mt-12 h-10 w-72 rounded-xl bg-[#e8ebe3]" />
          <div className="mt-8 h-52 rounded-[1.5rem] bg-[#e8ebe3]" />
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen bg-[#f7f8f4] px-5 py-10 text-[#2b3729] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="flex items-center justify-between border-b border-black/5 pb-5">
            <Link href="/" className="font-semibold tracking-tight">adsurvey<span className="text-[#668154]">.studio</span></Link>
            <Link href="/" className="text-sm font-medium text-[#596156] hover:text-[#35563c]">Back to home</Link>
          </header>
          <section className="mx-auto mt-20 max-w-xl rounded-[2rem] border border-[#e8eae3] bg-white p-8 text-center shadow-[0_25px_75px_-50px_rgba(43,61,39,.35)] sm:p-12">
            <span className="text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">Your workspace</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-.04em]">Your campaigns are waiting.</h1>
            <p className="mt-3 text-sm leading-6 text-[#7b8076]">Sign in to see your credits and saved campaign ideas.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <SignInButton mode="modal"><button className="rounded-full border border-[#dfe3d9] px-6 py-3 text-sm font-semibold text-[#506547] hover:bg-[#f7f8f4]">Sign in</button></SignInButton>
              <SignUpButton mode="modal"><button className="rounded-full bg-[#35563c] px-6 py-3 text-sm font-semibold text-white hover:bg-[#28452f]">Create a free account</button></SignUpButton>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-5 py-7 text-[#2b3729] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between border-b border-black/5 pb-5">
          <Link href="/" className="font-semibold tracking-tight">adsurvey<span className="text-[#668154]">.studio</span></Link>
          <Link href="/" className="rounded-full border border-[#dfe3d9] bg-white px-4 py-2.5 text-sm font-semibold text-[#506547] transition hover:bg-[#edf1e8]">← Back to studio</Link>
        </header>

        <section className="py-10 sm:py-14">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">Your workspace</span>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">Your ideas, <span className="font-serif italic font-normal text-[#668154]">all together.</span></h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#7b8076]">Keep an eye on your credits and pick up where your campaigns left off.</p>
            </div>
            <Link href="/#studio" className="inline-flex w-fit items-center rounded-full bg-[#35563c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#28452f]">Create an ad idea ↗</Link>
          </div>
        </section>

        {loadError && <p role="alert" className="mb-6 rounded-2xl border border-[#e8c9c3] bg-[#fff7f5] px-4 py-3 text-sm text-[#8a5149]">{loadError}</p>}

        <section aria-labelledby="credits-heading" className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[1.75rem] bg-[#35563c] p-6 text-white shadow-[0_25px_70px_-40px_rgba(53,86,60,.5)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span id="credits-heading" className="text-xs font-semibold uppercase tracking-[.16em] text-white/65">Credits available</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">{isPro ? "Pro plan" : "Free plan"}</span>
            </div>
            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-6xl font-semibold tracking-[-.07em] sm:text-7xl">{creditsLeft ?? "—"}</span>
              <span className="text-sm text-white/65">of {balance?.limit ?? "—"} credits</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/75">One ad generation uses 1 credit. Generating a picture also uses 1 credit.</p>
            <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Credits used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usagePercent}>
              <div className="h-full rounded-full bg-[#c6d6b9] transition-[width]" style={{ width: `${usagePercent}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-white/60"><span>{balance?.used ?? "—"} used</span><span>{usagePercent}%</span></div>
          </div>

          <aside className="flex flex-col justify-between rounded-[1.75rem] border border-[#e8eae3] bg-white p-6 sm:p-8">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[.16em] text-[#779067]">{isPro ? "A little more room" : "Ready to grow?"}</span>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-.04em]">{isPro ? "Your Pro credits are ready." : "Make room for more ideas."}</h2>
              <p className="mt-3 text-sm leading-6 text-[#7b8076]">{isPro ? "Your plan includes up to 1,000 generations each month." : "Pro includes 1,000 generations each month, plus space to keep every campaign together."}</p>
            </div>
            <Link href="/#pricing" className="mt-7 inline-flex w-fit items-center rounded-full border border-[#dfe3d9] px-5 py-3 text-sm font-semibold text-[#506547] transition hover:bg-[#f7f8f4]">{isPro ? "View plan details" : "See plans"} ↗</Link>
          </aside>
        </section>

        <section aria-labelledby="campaigns-heading" className="pb-14 pt-12 sm:pt-16">
          <div className="flex flex-col justify-between gap-4 border-b border-black/5 pb-5 sm:flex-row sm:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[.16em] text-[#779067]">Your work</span>
              <h2 id="campaigns-heading" className="mt-2 text-3xl font-semibold tracking-[-.04em]">Saved campaigns <span className="ml-1 text-base font-medium text-[#92988d]">{savedAds.length}</span></h2>
            </div>
            {savedAds.length > 0 && <label className="block w-full sm:max-w-xs"><span className="sr-only">Search campaigns</span><input type="search" placeholder="Search by brand, product, or audience" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-full border border-[#e1e4dc] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#a0a399] focus:border-[#9caf8c] focus:ring-2 focus:ring-[#9caf8c]/20" /></label>}
          </div>

          {savedAds.length === 0 ? (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-[#d8ddd2] bg-white/70 px-6 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e9eee2] text-xl text-[#668154]">✳</span>
              <h3 className="mt-4 text-lg font-semibold">Your first campaign starts here.</h3>
              <p className="mt-2 text-sm text-[#7b8076]">Create an ad idea and it will be saved to this workspace.</p>
              <Link href="/#studio" className="mt-5 inline-flex rounded-full bg-[#35563c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#28452f]">Go to the studio ↗</Link>
            </div>
          ) : filteredAds.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-white px-5 py-8 text-center text-sm text-[#7b8076]">No campaigns match “{search}”.</p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAds.map((ad) => (
                <article key={ad.id} className="flex min-w-0 flex-col rounded-[1.5rem] border border-[#e8eae3] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-35px_rgba(43,61,39,.35)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[.12em] text-[#8a9780]">{ad.brand_name || "Campaign"}</p><h3 className="mt-2 line-clamp-2 text-lg font-semibold tracking-tight text-[#2f3a2d]">{ad.product || "Untitled idea"}</h3></div>
                    <span className="shrink-0 rounded-full bg-[#f0f3e9] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#607451]">Saved</span>
                  </div>
                  {ad.audience && <p className="mt-3 line-clamp-2 text-sm leading-5 text-[#7b8076]">For {ad.audience}</p>}
                  <p className="mt-4 text-xs text-[#9aa092]">{Number.isNaN(new Date(ad.created_at).getTime()) ? "" : new Date(ad.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                  {ad.generated_ads && <details className="mt-4 border-t border-[#ecefe8] pt-3"><summary className="cursor-pointer text-sm font-semibold text-[#52664a]">View ad copy</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#f7f8f4] p-4 font-sans text-xs leading-5 text-[#5e665a]">{ad.generated_ads}</pre></details>}
                  <button type="button" onClick={() => void deleteAd(ad.id)} disabled={deletingId === ad.id} className="mt-auto self-start pt-5 text-xs font-semibold text-[#8a5149] transition hover:text-[#663d37] disabled:opacity-50">{deletingId === ad.id ? "Deleting…" : "Delete campaign"}</button>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-black/5 py-6 text-xs text-[#979c92]">Your saved campaigns and credit balance are tied to your signed-in account.</footer>
      </div>
    </main>
  );
}

