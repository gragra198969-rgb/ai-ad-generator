"use client";

import { useEffect, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

type SavedAd = {
  id: number;
  brand_name?: string;
  product?: string;
  generated_ads?: string;
};

const platforms = ["Instagram", "Facebook", "Google", "TikTok", "LinkedIn", "Email"];

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [brandName, setBrandName] = useState("");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [benefit, setBenefit] = useState("");
  const [website, setWebsite] = useState("");
  const [tone, setTone] = useState("friendly");
  const [adType, setAdType] = useState("facebook");
  const [adCount, setAdCount] = useState("5");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [savedAds, setSavedAds] = useState<SavedAd[]>([]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    async function loadAccount() {
      try {
        const [userResponse, adsResponse] = await Promise.all([fetch("/api/user"), fetch("/api/ads")]);
        const userData = await userResponse.json();
        const adsData = await adsResponse.json();
        if (cancelled) return;
        if (userResponse.ok) setCreditsLeft(Number(userData.ads_limit) - Number(userData.ads_used));
        if (adsResponse.ok && Array.isArray(adsData)) setSavedAds(adsData);
      } catch {
        if (!cancelled) setMessage("We couldn’t load your saved work. Please refresh and try again.");
      }
    }
    void loadAccount();
    return () => { cancelled = true; };
  }, [isSignedIn]);

  async function generateAds() {
    setMessage("");
    if (!isSignedIn) {
      setMessage("Sign in to create and save your ads.");
      return;
    }
    if (!product.trim() || !audience.trim()) {
      setMessage("Add a product and target audience to get started.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, product, audience, benefit, website, tone, adType, adCount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.result || "Ad generation failed. Please try again.");
      setResult(data.result || "No ad was returned. Please try again.");
      const userResponse = await fetch("/api/user");
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setCreditsLeft(Number(userData.ads_limit) - Number(userData.ads_used));
      }
      const adsResponse = await fetch("/api/ads");
      if (adsResponse.ok) {
        const adsData = await adsResponse.json();
        if (Array.isArray(adsData)) setSavedAds(adsData);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyAds() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setMessage("Your ad copy is ready to paste.");
    } catch {
      setMessage("Copy wasn’t available in this browser. Select the ad text to copy it.");
    }
  }

  async function upgrade() {
    setMessage("");
    if (!isSignedIn) {
      setMessage("Create a free account or sign in to continue to secure checkout.");
      return;
    }
    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Checkout is unavailable right now.");
      window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn’t open checkout.");
    }
  }

  async function upgradeWithPayPal() {
    setCheckoutMessage("");
    if (!isSignedIn) {
      setCheckoutMessage("Create a free account or sign in to continue to secure checkout.");
      return;
    }
    try {
      const response = await fetch("/api/paypal/checkout", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "PayPal checkout is unavailable right now.");
      window.location.href = data.url;
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : "Couldn’t open PayPal checkout.");
    }
  }

  const pageClass = darkMode ? "min-h-screen bg-[#10131b] text-white" : "min-h-screen bg-[#fbfaf8] text-[#20231f]";

  return (
    <main className={pageClass}>
      <div className="border-b border-black/5 bg-[#f2f4e9] px-4 py-2 text-center text-xs font-medium tracking-wide text-[#475b3d]">
        Ad ideas today · customer surveys are in development
      </div>
      <header className={`sticky top-0 z-20 border-b backdrop-blur-xl ${darkMode ? "border-white/10 bg-[#10131b]/90" : "border-black/5 bg-[#fbfaf8]/90"}`}>
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8" aria-label="Main navigation">
          <a href="#top" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="AdSurvey Pro home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#35563c] text-lg text-white">A</span>
            <span className="text-lg">adsurvey<span className="text-[#668154]">.studio</span></span>
          </a>
          <div className="hidden items-center gap-8 text-sm text-[#6c7168] md:flex">
            <a className="transition hover:text-[#35563c]" href="#studio">Ad studio</a>
            <a className="transition hover:text-[#35563c]" href="#surveys">Surveys</a>
            <a className="transition hover:text-[#35563c]" href="#how-it-works">How it works</a>
            <a className="transition hover:text-[#35563c]" href="#pricing">Pricing</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className={`rounded-full px-3 py-2 text-xs font-medium transition ${darkMode ? "text-white/70 hover:bg-white/10" : "text-[#5f675b] hover:bg-black/5"}`} aria-label="Toggle color theme">{darkMode ? "☀ Light" : "◐ Theme"}</button>
            {isLoaded && isSignedIn ? <><a href="/dashboard" className="hidden rounded-full px-3 py-2 text-sm text-[#687064] sm:inline">My workspace</a><UserButton /></> : <><SignInButton mode="modal"><button className="rounded-full px-3 py-2 text-sm font-medium text-[#596156] transition hover:bg-black/5">Sign in</button></SignInButton><SignUpButton mode="modal"><button className="rounded-full bg-[#35563c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28452f]">Get started</button></SignUpButton></>}
          </div>
        </nav>
      </header>

      <section id="top" className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute -right-24 top-8 -z-10 h-96 w-96 rounded-full bg-[#e2e9d7] blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.03fr_.97fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dbe3d4] bg-white/70 px-3.5 py-2 text-xs font-semibold text-[#527047]"><span className="h-2 w-2 rounded-full bg-[#86a36b]" /> Your campaign ideas, in one workspace</div>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.04] tracking-[-.055em] sm:text-6xl lg:text-[4.4rem]">Good marketing starts with <span className="font-serif italic font-normal text-[#668154]">listening.</span></h1>
            <p className={`mt-6 max-w-xl text-lg leading-8 ${darkMode ? "text-white/65" : "text-[#73776e]"}`}>Create fresh ad copy for your next campaign. Customer surveys are in development, with a preview below.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#studio" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#35563c] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#35563c]/15 transition hover:-translate-y-0.5 hover:bg-[#28452f]">Try the ad studio <span aria-hidden="true">↗</span></a>
              <a href="#surveys" className={`inline-flex items-center justify-center rounded-full border px-6 py-3.5 text-sm font-semibold transition ${darkMode ? "border-white/15 hover:bg-white/5" : "border-[#dfe1d9] bg-white/60 hover:bg-white"}`}>Explore customer surveys</a>
            </div>
            <div className={`mt-8 flex items-center gap-3 text-sm ${darkMode ? "text-white/55" : "text-[#83877f]"}`}><div className="flex -space-x-2"><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#fbfaf8] bg-[#dce4d1] text-xs">✳</span><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#fbfaf8] bg-[#f1dfca] text-xs">◌</span><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#fbfaf8] bg-[#d9e6e4] text-xs">✦</span></div><span>Clear ideas. A simpler next step.</span></div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -left-5 top-16 z-10 hidden rounded-2xl border border-black/5 bg-white p-4 shadow-xl shadow-black/5 sm:block"><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#9a9e92]">A better starting brief</div><div className="mt-2 text-sm font-semibold text-[#35563c]">Product · audience · voice</div><div className="mt-1 text-[10px] text-[#777d70]">Small details shape the copy</div><div className="mt-3 flex gap-1.5">{["bg-[#cbd8bf]", "bg-[#e8d7c3]", "bg-[#d3dfdc]"].map((tone) => <i key={tone} className={`h-2 w-8 rounded-full ${tone}`} />)}</div></div>
            <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-white p-3 shadow-[0_35px_100px_-45px_rgba(40,55,36,.35)] sm:p-5">
              <div className="flex items-center justify-between px-2 pb-4 pt-1"><div><div className="text-xs font-semibold text-[#a0a399]">CAMPAIGN IDEA · SAMPLE</div><div className="mt-1 text-sm font-semibold">A little more you, everywhere</div></div><span className="rounded-full bg-[#edf3e8] px-3 py-1.5 text-[10px] font-semibold text-[#58734c]">CONCEPT</span></div>
              <div className="rounded-[1.5rem] bg-[#f3f5ed] p-5 sm:p-7"><div className="flex items-center justify-between"><span className="text-xs font-semibold tracking-wide text-[#667360]">SAMPLE CAMPAIGN</span><span className="text-xs text-[#92988c]">Illustrative concept</span></div><div className="mt-8 max-w-sm"><div className="text-3xl font-semibold leading-tight tracking-[-.04em] text-[#2d392b]">Make room for <span className="font-serif italic font-normal text-[#668154]">better days.</span></div><p className="mt-3 max-w-xs text-sm leading-6 text-[#727a6d]">A sample direction for a fictional everyday essentials brand.</p><span className="mt-5 inline-flex rounded-full bg-[#35563c] px-5 py-2.5 text-xs font-semibold text-white">Example ad concept ↗</span></div><div className="mt-8 flex items-end justify-between"><div className="flex gap-2"><span className="h-14 w-14 rounded-full bg-[#d2ddc7]"/><span className="h-14 w-14 rounded-full bg-[#e7d7c5]"/><span className="h-14 w-14 rounded-full bg-[#cbdad4]"/></div><span className="rounded-full bg-white px-3 py-2 text-[10px] font-medium text-[#65705f]">✦ On-brand copy</span></div></div>
              <div className="grid grid-cols-3 gap-2 pt-3"><div className="rounded-xl bg-[#faf9f6] p-3"><div className="text-[10px] text-[#a0a399]">COPY ANGLES</div><div className="mt-1 text-sm font-semibold">5 fresh ideas</div></div><div className="rounded-xl bg-[#faf9f6] p-3"><div className="text-[10px] text-[#a0a399]">AUDIENCE</div><div className="mt-1 text-sm font-semibold">In focus</div></div><div className="rounded-xl bg-[#faf9f6] p-3"><div className="text-[10px] text-[#a0a399]">NEXT UP</div><div className="mt-1 text-sm font-semibold">Ask & learn</div></div></div>
            </div>
            <div className="absolute -bottom-5 -right-3 hidden rounded-2xl border border-black/5 bg-white p-4 shadow-xl shadow-black/5 sm:block"><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#9a9e92]">A useful next step</div><div className="mt-2 text-sm font-medium text-[#3e493b]">Find your clearest message</div><div className="mt-1 text-xs text-[#92988c]">Start with what you know</div></div>
          </div>
        </div>
      </section>

      <section className="border-y border-black/5 bg-white/60 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-5 sm:flex-row sm:justify-between lg:px-8"><span className="text-xs font-semibold uppercase tracking-[.16em] text-[#a0a399]">Made for the places you show up</span><div className="flex flex-wrap justify-center gap-x-7 gap-y-2 text-sm font-semibold text-[#858a80]">{platforms.map((platform) => <span key={platform}>{platform}</span>)}</div></div>
      </section>

      <section id="studio" className="scroll-mt-24 px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center"><span className="text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">The ad studio</span><h2 className="mt-4 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Turn a good idea into <span className="font-serif italic font-normal text-[#668154]">great copy.</span></h2><p className={`mt-4 text-base leading-7 ${darkMode ? "text-white/60" : "text-[#777c72]"}`}>Give us the essentials. Get a handful of distinct, ready-to-refine directions for your next campaign.</p></div>
          <div className={`mx-auto mt-11 grid max-w-5xl overflow-hidden rounded-[2rem] border shadow-[0_25px_80px_-55px_rgba(30,40,28,.35)] lg:grid-cols-[.72fr_1.28fr] ${darkMode ? "border-white/10 bg-[#171b24]" : "border-black/5 bg-white"}`}>
            <div className="bg-[#35563c] p-7 text-white sm:p-9"><span className="text-xs font-semibold uppercase tracking-[.16em] text-white/60">Start here</span><h3 className="mt-5 text-3xl font-semibold leading-tight tracking-[-.04em]">Tell us what you’re bringing to the world.</h3><p className="mt-4 text-sm leading-6 text-white/70">A few details help shape copy that sounds closer to you and speaks to the people you want to reach.</p><div className="mt-10 rounded-2xl border border-white/15 bg-white/5 p-4"><div className="text-xs font-semibold text-white/60">YOUR WORKSPACE</div><div className="mt-2 text-sm">{isLoaded && isSignedIn ? "Signed in and ready" : "Sign in to save your campaigns"}</div>{creditsLeft !== null && <div className="mt-3 text-xs text-white/70">{Math.max(0, creditsLeft)} generations available</div>}</div><div className="mt-8 space-y-3 text-sm text-white/75"><p>✳ Distinct creative directions</p><p>✳ Tailored to your audience</p><p>✳ Saved to your workspace</p></div></div>
            <div className="p-6 sm:p-9">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[#697064]">Brand name <span className="font-normal text-[#a0a399]">(optional)</span><input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. Sunday Supply" className="mt-2 w-full rounded-xl border border-[#e6e7e1] bg-[#fcfcfa] px-4 py-3 text-sm font-normal text-[#20231f] outline-none transition placeholder:text-[#b1b4ac] focus:border-[#91a783] focus:ring-4 focus:ring-[#dbe6d3]/60" /></label>
                <label className="text-xs font-semibold text-[#697064]">Product or service *<input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="What are you offering?" className="mt-2 w-full rounded-xl border border-[#e6e7e1] bg-[#fcfcfa] px-4 py-3 text-sm font-normal text-[#20231f] outline-none transition placeholder:text-[#b1b4ac] focus:border-[#91a783] focus:ring-4 focus:ring-[#dbe6d3]/60" /></label>
                <label className="text-xs font-semibold text-[#697064] sm:col-span-2">Who do you want to reach? *<input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Describe your ideal customer" className="mt-2 w-full rounded-xl border border-[#e6e7e1] bg-[#fcfcfa] px-4 py-3 text-sm font-normal text-[#20231f] outline-none transition placeholder:text-[#b1b4ac] focus:border-[#91a783] focus:ring-4 focus:ring-[#dbe6d3]/60" /></label>
                <label className="text-xs font-semibold text-[#697064] sm:col-span-2">What makes it worth choosing?<span className="font-normal text-[#a0a399]"> (optional)</span><input value={benefit} onChange={(e) => setBenefit(e.target.value)} placeholder="A benefit, feeling, or detail customers value" className="mt-2 w-full rounded-xl border border-[#e6e7e1] bg-[#fcfcfa] px-4 py-3 text-sm font-normal text-[#20231f] outline-none transition placeholder:text-[#b1b4ac] focus:border-[#91a783] focus:ring-4 focus:ring-[#dbe6d3]/60" /></label>
                <label className="text-xs font-semibold text-[#697064]">Channel<select value={adType} onChange={(e) => setAdType(e.target.value)} className="mt-2 w-full rounded-xl border border-[#e6e7e1] bg-[#fcfcfa] px-4 py-3 text-sm font-normal text-[#33382f] outline-none focus:border-[#91a783]"><option value="facebook">Facebook ad</option><option value="google">Google ad</option><option value="email">Email marketing</option><option value="tiktok">TikTok ad</option><option value="instagram">Instagram caption</option><option value="twitter">X / Twitter post</option><option value="linkedin">LinkedIn ad</option></select></label>
                <label className="text-xs font-semibold text-[#697064]">Voice<select value={tone} onChange={(e) => setTone(e.target.value)} className="mt-2 w-full rounded-xl border border-[#e6e7e1] bg-[#fcfcfa] px-4 py-3 text-sm font-normal text-[#33382f] outline-none focus:border-[#91a783]"><option value="friendly">Warm & friendly</option><option value="professional">Clear & professional</option><option value="exciting">Bright & energetic</option></select></label>
                <label className="text-xs font-semibold text-[#697064]">Website <span className="font-normal text-[#a0a399]">(optional)</span><input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourwebsite.com" className="mt-2 w-full rounded-xl border border-[#e6e7e1] bg-[#fcfcfa] px-4 py-3 text-sm font-normal text-[#20231f] outline-none transition placeholder:text-[#b1b4ac] focus:border-[#91a783] focus:ring-4 focus:ring-[#dbe6d3]/60" /></label>
                <label className="text-xs font-semibold text-[#697064]">Number of ideas<select value={adCount} onChange={(e) => setAdCount(e.target.value)} className="mt-2 w-full rounded-xl border border-[#e6e7e1] bg-[#fcfcfa] px-4 py-3 text-sm font-normal text-[#33382f] outline-none focus:border-[#91a783]"><option value="5">5 ideas</option><option value="10">10 ideas</option><option value="20">20 ideas</option></select></label>
              </div>
              {isSignedIn ? <button onClick={generateAds} disabled={loading || creditsLeft === 0} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#35563c] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#28452f] disabled:cursor-not-allowed disabled:opacity-55">{loading ? <><span className="animate-spin">◌</span> Finding your angle…</> : creditsLeft === 0 ? "You’re out of generations" : "✳ Create my ad ideas"}</button> : <SignUpButton mode="modal"><button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#35563c] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#28452f]">Create a free account to start ↗</button></SignUpButton>}
              {message && <p aria-live="polite" className="mt-3 rounded-xl bg-[#f5f6f1] px-4 py-3 text-sm text-[#53624c]">{message}</p>}
              {result && <div className="mt-5 rounded-2xl border border-[#e6e9df] bg-[#fbfcf9] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold text-[#344332]">Your campaign ideas</h4><div className="flex gap-2"><button onClick={copyAds} className="rounded-full border border-[#dfe4d9] px-3 py-1.5 text-xs font-semibold text-[#52664a] hover:bg-[#f1f4ed]">Copy text</button><button onClick={() => { const blob = new Blob([result], { type: "text/plain" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "ads.txt"; link.click(); URL.revokeObjectURL(url); }} className="rounded-full border border-[#dfe4d9] px-3 py-1.5 text-xs font-semibold text-[#52664a] hover:bg-[#f1f4ed]">Download</button></div></div><pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap font-sans text-sm leading-6 text-[#60675b]">{result}</pre></div>}
            </div>
          </div>
          {isSignedIn && savedAds.length > 0 && <div className="mx-auto mt-8 max-w-5xl"><details className={`rounded-2xl border p-5 ${darkMode ? "border-white/10 bg-[#171b24]" : "border-black/5 bg-white"}`}><summary className="cursor-pointer text-sm font-semibold">Your recent work <span className="ml-1 text-[#858a80]">({savedAds.length})</span></summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{savedAds.slice(0, 4).map((ad) => <div key={ad.id} className="rounded-xl bg-[#f7f8f4] p-4"><div className="text-sm font-semibold text-[#3d4c39]">{ad.brand_name || ad.product || "Campaign"}</div><div className="mt-1 text-xs text-[#858a80]">{ad.product}</div></div>)}</div><a href="/dashboard" className="mt-4 inline-flex text-sm font-semibold text-[#547249]">Open your workspace ↗</a></details></div>}
        </div>
      </section>

      <section id="surveys" className="scroll-mt-20 bg-[#f0f3e9] px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
          <div><span className="inline-flex rounded-full bg-[#e1e9d9] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.13em] text-[#648056]">Coming soon · survey tools</span><h2 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-.045em] text-[#263326] sm:text-5xl">The best next step? <span className="font-serif italic font-normal text-[#668154]">Ask.</span></h2><p className="mt-5 max-w-xl text-base leading-7 text-[#73796e]">We’re shaping simple customer surveys to pair with your campaign ideas. The preview is illustrative; survey creation and response collection aren’t available yet.</p><div className="mt-8 space-y-4">{[["01", "Start with a useful question", "Keep it short, specific, and easy to answer."], ["02", "Hear what matters to people", "Give customers a clear, simple way to share feedback."], ["03", "Bring the learning back to your ads", "Use what you hear to shape your next message."]].map(([number, title, copy]) => <div key={number} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#668154]">{number}</span><div><h3 className="text-sm font-semibold text-[#3c4638]">{title}</h3><p className="mt-1 text-sm text-[#81867b]">{copy}</p></div></div>)}</div></div>
          <div className="relative mx-auto w-full max-w-lg"><div className="absolute -right-4 -top-4 h-24 w-24 rounded-full border border-[#aebda1]"/><div className="relative rounded-[2rem] bg-white p-6 shadow-[0_25px_75px_-45px_rgba(43,61,39,.35)] sm:p-8"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[.15em] text-[#96a18d]">Illustrative survey preview</span><span className="text-xs text-[#9aa092]">Concept</span></div><h3 className="mt-7 text-2xl font-semibold tracking-tight text-[#2f3a2d]">What would make your next visit even better?</h3><p className="mt-2 text-sm text-[#8c9187]">A little context helps us improve.</p><div className="mt-6 space-y-2.5">{["More options to choose from", "A smoother checkout", "Helpful tips along the way"].map((choice, index) => <div key={choice} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${index === 1 ? "border-[#9caf8c] bg-[#f4f7f0] text-[#506547]" : "border-[#eeefe9] text-[#6f756c]"}`}><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${index === 1 ? "border-[#739064]" : "border-[#d7dacf]"}`}>{index === 1 && <i className="h-2 w-2 rounded-full bg-[#739064]"/>}</span>{choice}</div>)}</div><div className="mt-5 flex items-center justify-between"><span className="text-xs text-[#a1a59c]">Survey tools are in development</span><span className="rounded-full bg-[#e7ede1] px-4 py-2 text-xs font-semibold text-[#52664a]">Coming soon</span></div></div><div className="absolute -bottom-5 -left-4 rounded-2xl border border-black/5 bg-white px-4 py-3 shadow-lg"><div className="text-[10px] uppercase tracking-[.14em] text-[#a0a399]">A thoughtful feedback loop</div><div className="mt-1 text-sm font-semibold text-[#52664a]">Listen · learn · create</div></div></div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><span className="text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">Simple by design</span><h2 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-.045em] sm:text-5xl">A little less guesswork. <span className="font-serif italic font-normal text-[#668154]">A lot more you.</span></h2></div><p className={`max-w-md text-sm leading-6 ${darkMode ? "text-white/60" : "text-[#777c72]"}`}>Keep your message grounded in what you offer and what your customers actually care about.</p></div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">{[["01", "Share the essentials", "Tell us about your offer, your audience, and the feeling you want your brand to leave."], ["02", "Explore new directions", "Review a set of distinct ad concepts and refine the ones that sound like you."], ["03", "Listen and keep learning", "Gather feedback and carry what you learn into the next campaign."]].map(([n, title, copy]) => <article key={n} className={`rounded-[1.5rem] border p-7 ${darkMode ? "border-white/10 bg-[#171b24]" : "border-[#ebede6] bg-white"}`}><span className="font-serif text-3xl italic text-[#90a783]">{n}</span><h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3><p className={`mt-3 text-sm leading-6 ${darkMode ? "text-white/55" : "text-[#7b8076]"}`}>{copy}</p></article>)}</div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 border-y border-black/5 bg-white/65 px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center"><div><span className="text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">Start free, grow when ready</span><h2 className="mt-4 text-4xl font-semibold tracking-[-.045em]">Good work should have room to <span className="font-serif italic font-normal text-[#668154]">grow.</span></h2><p className="mt-4 max-w-lg text-sm leading-6 text-[#7b8076]">Explore the ad studio, keep your ideas together, and upgrade when you need more monthly generations.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-[#e8eae3] bg-white p-6">
              <div className="text-sm font-semibold">Free</div>
              <div className="mt-3 text-4xl font-semibold tracking-[-.05em]">$0<span className="text-sm font-normal tracking-normal text-[#94998e]"> / always</span></div>
              <p className="mt-3 text-sm text-[#80857b]">A lovely place to start.</p>
              <ul className="mt-6 space-y-3 text-sm text-[#61685d]"><li>✓ 50 generations</li><li>✓ Multiple channels and tones</li><li>✓ Saved campaign history</li></ul>
              <a href="#studio" className="mt-7 block rounded-full border border-[#dfe3d9] px-4 py-3 text-center text-sm font-semibold text-[#506547] hover:bg-[#f7f8f4]">Try the studio</a>
            </div>
            <div className="rounded-[1.5rem] bg-[#35563c] p-6 text-white shadow-xl shadow-[#35563c]/15">
              <div className="flex items-center justify-between"><div className="text-sm font-semibold">Pro</div><span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold">FOR YOUR NEXT CHAPTER</span></div>
              <div className="mt-3 text-4xl font-semibold tracking-[-.05em]">$19.99<span className="text-sm font-normal tracking-normal text-white/60"> / month</span></div>
              <p className="mt-3 text-sm text-white/65">More room for more good ideas.</p>
              <ul className="mt-6 space-y-3 text-sm text-white/85"><li>✓ 1,000 generations each month</li><li>✓ Save unlimited ads</li><li>✓ Keep every campaign in one place</li></ul>
              {isSignedIn ? <div className="mt-7 space-y-3"><button onClick={upgrade} className="block w-full rounded-full bg-white px-4 py-3 text-center text-sm font-semibold text-[#35563c] transition hover:bg-[#edf1e8]">Subscribe by card ↗</button>{process.env.NEXT_PUBLIC_PAYPAL_CHECKOUT_ENABLED === "true" && <button onClick={upgradeWithPayPal} className="block w-full rounded-full border border-white/35 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10">Subscribe with PayPal ↗</button>}</div> : <SignUpButton mode="modal"><button className="mt-7 block w-full rounded-full bg-white px-4 py-3 text-center text-sm font-semibold text-[#35563c] transition hover:bg-[#edf1e8]">Create an account to choose Pro ↗</button></SignUpButton>}
              {checkoutMessage && <p aria-live="polite" className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-sm text-white">{checkoutMessage}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8"><div className="mx-auto max-w-5xl rounded-[2rem] bg-[#e9eee2] px-6 py-12 text-center sm:px-12 sm:py-16"><span className="text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">Your next good idea starts here</span><h2 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-[-.045em] text-[#2b3729] sm:text-5xl">Make something people <span className="font-serif italic font-normal text-[#668154]">want to hear.</span></h2><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[#72796d]">Create your first ad concept today. No blank-page stare required.</p><a href="#studio" className="mt-7 inline-flex rounded-full bg-[#35563c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#28452f]">Let’s make a start ↗</a></div></section>

      <footer className={`border-t px-5 py-8 ${darkMode ? "border-white/10" : "border-black/5"}`}><div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><a href="#top" className="font-semibold">adsurvey<span className="text-[#668154]">.studio</span></a><div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#878c82]"><a href="/privacy" className="hover:text-[#35563c]">Privacy</a><a href="/terms" className="hover:text-[#35563c]">Terms</a><a href="/copyright" className="hover:text-[#35563c]">Copyright</a><a href="/faq" className="hover:text-[#35563c]">FAQ</a></div><span className="text-xs text-[#a0a399]">© {new Date().getFullYear()} AdSurvey Studio</span></div></footer>
      {/* temporary-greg-message:start */}
      <p className="px-5 pb-8 text-center text-sm">hey Mike this is from Greg.</p>
      {/* temporary-greg-message:end */}
    </main>
  );
}

