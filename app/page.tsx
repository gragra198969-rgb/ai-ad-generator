"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

type SavedAd = {
  id: number;
  brand_name?: string;
  product?: string;
  generated_ads?: string;
};

const platforms = ["Instagram", "Facebook", "Google", "TikTok", "LinkedIn", "Email"];

export default function Home() {
  const { user } = useUser();
  return <AdStudio key={user?.id ?? "signed-out"} />;
}

function AdStudio() {
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
  const [generatedImage, setGeneratedImage] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageMessage, setImageMessage] = useState("");
  const [message, setMessage] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [savedAds, setSavedAds] = useState<SavedAd[]>([]);
  const [tutorialOpen, setTutorialOpen] = useState(false);

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

  async function generatePicture() {
    setImageMessage("");
    if (!isSignedIn) {
      setImageMessage("Sign in to generate a picture.");
      return;
    }
    if (!product.trim() || !audience.trim()) {
      setImageMessage("Add a product and target audience first.");
      return;
    }
    if (imageLoading || loading) return;
    setImageLoading(true);
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, audience, benefit, brandName, adType, tone }),
      });
      const data = await response.json();
      if (!response.ok || !data.image) throw new Error(data.error || "Picture generation failed.");
      setGeneratedImage(data.image);
      setImageMessage("Your picture is ready. Download it to keep a copy.");
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "Picture generation failed. Please try again.");
    } finally {
      try {
        const response = await fetch("/api/user");
        if (response.ok) {
          const account = await response.json();
          setCreditsLeft(Number(account.ads_limit) - Number(account.ads_used));
        }
      } catch {
        // Keep the generation result available if the balance refresh fails.
      }
      setImageLoading(false);
    }
  }

  function parsedAds() {
    const chunks = result.split(/(?=AD #\\d+)/i).map((part) => part.trim()).filter(Boolean);
    return chunks.map((chunk, index) => {
      const headline = chunk.match(/Headline:\\s*([\\s\\S]*?)(?=\\n\\s*Body Copy:)/i)?.[1]?.trim() || `Ad idea ${index + 1}`;
      const body = chunk.match(/Body Copy:\\s*([\\s\\S]*?)(?=\\n\\s*Call To Action:)/i)?.[1]?.trim() || chunk;
      const cta = chunk.match(/Call To Action:\\s*([\\s\\S]*)$/i)?.[1]?.trim() || "";
      return { headline, body, cta, raw: chunk };
    });
  }

  async function copyAd(text = result) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Your ad copy is ready to paste.");
    } catch {
      setMessage("Copy wasn’t available in this browser. Select the ad text to copy it.");
    }
  }

  async function shareAd(platform: "facebook" | "tiktok" | "instagram" | "twitter" | "linkedin" | "nextdoor", adText = result) {
    if (!adText) return;

    const text = safeWebsite ? `${adText}\n\n${safeWebsite}` : adText;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(safeWebsite || window.location.href);

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Continue to the selected platform even if clipboard access is unavailable.
    }

    const shareUrls: Record<typeof platform, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      tiktok: "https://www.tiktok.com/upload",
      instagram: "https://www.instagram.com/",
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      nextdoor: "https://nextdoor.com/",
    };

    window.open(shareUrls[platform], "_blank", "noopener,noreferrer");
    setMessage(`Ad copied. ${platform === "twitter" ? "X" : platform.charAt(0).toUpperCase() + platform.slice(1)} opened so you can review and post it.`);
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

  const safeWebsite = /^https?:\/\//i.test(website.trim()) ? website.trim() : "";

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
            <button type="button" onClick={() => setTutorialOpen(true)} className="transition hover:text-[#35563c]">Tutorial</button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className={`rounded-full px-3 py-2 text-xs font-medium transition ${darkMode ? "text-white/70 hover:bg-white/10" : "text-[#5f675b] hover:bg-black/5"}`} aria-label="Toggle color theme">{darkMode ? "☀ Light" : "◐ Theme"}</button>
            {isLoaded && isSignedIn ? <><a href="/dashboard" className="hidden rounded-full px-3 py-2 text-sm text-[#687064] sm:inline">My workspace</a><UserButton /></> : <><SignInButton mode="modal"><button className="rounded-full px-3 py-2 text-sm font-medium text-[#596156] transition hover:bg-black/5">Sign in</button></SignInButton><SignUpButton mode="modal"><button className="rounded-full bg-[#35563c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#28452f]">Get started</button></SignUpButton></>}
          </div>
        </nav>
      </header>

      {tutorialOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" onClick={() => setTutorialOpen(false)}>
        <div className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-[1.75rem] bg-white p-6 text-[#20231f] shadow-2xl sm:p-8" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#779067]">Quick tutorial</p><h2 id="tutorial-title" className="mt-2 text-3xl font-semibold tracking-tight">Create your first ad in minutes</h2><p className="mt-2 text-sm leading-6 text-[#72796d]">Follow these steps from top to bottom. You can come back to this tutorial anytime.</p></div>
            <button type="button" onClick={() => setTutorialOpen(false)} aria-label="Close tutorial" className="rounded-full border border-[#e1e5dc] px-3 py-2 text-sm font-semibold text-[#65705f] hover:bg-[#f5f7f2]">✕</button>
          </div>
          <ol className="mt-7 space-y-4">
            {[
              ["1", "Sign in or create an account", "Your account keeps track of your generations and saved campaign history."],
              ["2", "Tell us what you’re advertising", "Enter your brand, product or service, target audience, main benefit, website, tone, and the type of ad you want."],
              ["3", "Create your ad ideas", "Tap “Create my ad ideas.” The studio will generate several different marketing angles for you to review."],
              ["4", "Add a campaign picture", "Use “Generate picture” when you want an AI-created visual to go with the campaign. Picture generation uses 1 credit."],
              ["5", "Review before posting", "Read the headline, body copy, CTA, and picture. Make any changes you need before using the advertisement publicly."],
              ["6", "Copy or share your ad", "Use Copy ad or choose Facebook, Instagram, TikTok, X, LinkedIn, or Nextdoor. We’ll copy the ad and open the platform so you can review it before posting."],
              ["7", "Find your work later", "Open My workspace to see your saved campaign history and continue working from there."],
            ].map(([number, title, copy]) => <li key={number} className="flex gap-4 rounded-2xl border border-[#e7ebe2] bg-[#fafbf8] p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#35563c] text-xs font-semibold text-white">{number}</span><div><h3 className="text-sm font-semibold text-[#344332]">{title}</h3><p className="mt-1 text-xs leading-5 text-[#72796d]">{copy}</p></div></li>)}
          </ol>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => { setTutorialOpen(false); document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" }); }} className="rounded-full bg-[#35563c] px-5 py-3 text-sm font-semibold text-white hover:bg-[#28452f]">Start creating an ad ↗</button>
            <button type="button" onClick={() => setTutorialOpen(false)} className="rounded-full border border-[#dfe3d9] px-5 py-3 text-sm font-semibold text-[#52664a] hover:bg-[#f5f7f2]">Close tutorial</button>
          </div>
        </div>
      </div>}

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
              <div className="rounded-[1.5rem] bg-[#f3f5ed] p-5 sm:p-7"><div className="flex items-center justify-between"><span className="text-xs font-semibold tracking-wide text-[#667360]">SAMPLE CAMPAIGN</span><span className="text-xs text-[#92988c]">Illustrative concept</span></div><div className="mt-8 max-w-sm"><div className="text-3xl font-semibold leading-tight tracking-[-.04em] text-[#2d392b]">Make room for <span className="font-serif italic font-normal text-[#668154]">better days.</span></div><p className="mt-3 max-w-xs text-sm leading-6 text-[#727a6d]">A sample direction for a fictional everyday essentials brand.</p><details className="group mt-5">
                  <summary className="inline-flex cursor-pointer list-none items-center rounded-full bg-[#35563c] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#28452f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#35563c] [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">View sample ads ↗</span>
                    <span className="hidden group-open:inline">Close sample ads ↑</span>
                  </summary>
                  <div className="mt-4 rounded-2xl border border-[#dbe3d4] bg-white p-4 text-[#2d392b]">
                    <h3 className="text-sm font-semibold">Sunday Supply · sample campaign</h3>
                    <p className="mt-2 text-xs leading-5 text-[#727a6d]">Five ready-written examples for a fictional everyday essentials brand. No account or credits needed.</p>
                    <ol className="mt-4 space-y-4">
                      {[
                        { headline: "Make room for better days", body: "Meet everyday essentials that fit the moments you love: slow mornings, fresh starts, and a space that feels like you.", cta: "Find your everyday favorites." },
                        { headline: "A fresh start feels like home", body: "A favorite mug. A soft throw. A little corner of calm. Bring a personal touch to your daily routine with Sunday Supply.", cta: "Explore your next small refresh." },
                        { headline: "Small details, a little more you", body: "Your space tells a story. Add everyday pieces that make it yours, from the first cup of coffee to the last page of the evening.", cta: "Make yourself at home." },
                        { headline: "Give your everyday a Sunday feeling", body: "You don't need a special occasion to enjoy your space. Find inspiration for the little rituals that make an ordinary day feel good.", cta: "Discover your Sunday inspiration." },
                        { headline: "What belongs in your favorite corner?", body: "Start with one thoughtful detail. Build a space around the things you reach for, enjoy, and choose again every day.", cta: "Find a detail to call your own." },
                      ].map((ad, index) => (
                        <li key={ad.headline} className="border-t border-[#e8eae3] pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#779067]">Sample ad {index + 1}</p>
                          <h4 className="mt-1 text-sm font-semibold">{ad.headline}</h4>
                          <p className="mt-2 text-xs leading-5 text-[#60675b]">{ad.body}</p>
                          <p className="mt-2 text-xs font-semibold text-[#35563c]">{ad.cta}</p>
                        </li>
                      ))}
                    </ol>
                    <a href="#studio" className="mt-5 inline-flex rounded-full border border-[#dfe3d9] px-4 py-2 text-xs font-semibold text-[#35563c] hover:bg-[#f3f5ed] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#35563c]">Create ads for your own brand ↗</a>
                  </div>
                </details></div><div className="mt-8 flex items-end justify-between"><div className="flex gap-2"><span className="h-14 w-14 rounded-full bg-[#d2ddc7]"/><span className="h-14 w-14 rounded-full bg-[#e7d7c5]"/><span className="h-14 w-14 rounded-full bg-[#cbdad4]"/></div><span className="rounded-full bg-white px-3 py-2 text-[10px] font-medium text-[#65705f]">✦ On-brand copy</span></div></div>
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
              {isSignedIn ? <button onClick={generateAds} disabled={loading || imageLoading || creditsLeft === 0} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#35563c] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#28452f] disabled:cursor-not-allowed disabled:opacity-55">{loading ? <><span className="animate-spin">◌</span> Finding your angle…</> : creditsLeft === 0 ? "You’re out of generations" : "✳ Create my ad ideas"}</button> : <SignUpButton mode="modal"><button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#35563c] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#28452f]">Create a free account to start ↗</button></SignUpButton>}
              <div className="mt-5 rounded-2xl border border-[#e6e9df] bg-[#fbfcf9] p-5">
                <h4 className="font-semibold text-[#344332]">Add a picture to your ad</h4>
                <p className="mt-2 text-xs leading-5 text-[#60675b]">Create a square image from the product, audience, and style above. Each picture uses 1 credit. Download it before leaving; pictures are not saved to your workspace yet.</p>
                {isSignedIn ? <button type="button" onClick={generatePicture} disabled={imageLoading || loading || creditsLeft === 0} className="mt-4 w-full rounded-xl border border-[#35563c] px-5 py-3 text-sm font-semibold text-[#35563c] transition hover:bg-[#edf3e8] disabled:cursor-not-allowed disabled:opacity-55">{imageLoading ? "Creating your picture…" : creditsLeft === 0 ? "You’re out of generations" : "Generate picture · 1 credit"}</button> : <p className="mt-3 text-xs text-[#60675b]">Sign in or create a free account above to generate pictures.</p>}
                <p aria-live="polite" role="status" className="mt-3 text-sm text-[#53624c]">{imageLoading ? "This can take a couple of minutes. Keep this page open." : imageMessage}</p>
                {generatedImage && <figure className="mt-4">
                  <Image src={generatedImage} alt="AI-generated advertising concept from your product brief" width={1024} height={1024} unoptimized className="h-auto w-full rounded-xl" />
                  <figcaption className="mt-2 text-xs text-[#727a6d]">AI-generated concept. Review for accuracy before using it in an advertisement.</figcaption>
                  <a href={generatedImage} download="ad-picture.png" className="mt-3 inline-flex rounded-full bg-[#35563c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#28452f]">Download picture (PNG)</a>
                </figure>}
              </div>
              {message && <p aria-live="polite" className="mt-3 rounded-xl bg-[#f5f6f1] px-4 py-3 text-sm text-[#53624c]">{message}</p>}
              {result && <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#dfe5d9] bg-white shadow-[0_22px_55px_-38px_rgba(40,55,36,.45)]">
                {generatedImage ? <div className="relative aspect-square w-full overflow-hidden bg-[#eef2e9] sm:aspect-[16/9]">
                  <Image src={generatedImage} alt="AI-generated campaign visual" fill unoptimized className="object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-6 pb-5 pt-16 text-white">
                    <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/75">{brandName || "Your brand"} · {adType}</p>
                    <h4 className="mt-1 max-w-xl text-2xl font-semibold tracking-tight">{benefit || product}</h4>
                  </div>
                </div> : <div className="flex min-h-40 items-end bg-gradient-to-br from-[#e8eee1] via-[#f5f0e6] to-[#dce8e5] p-6">
                  <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#71836a]">{brandName || "Your brand"} · campaign</p><h4 className="mt-2 text-2xl font-semibold tracking-tight text-[#30402e]">{benefit || product}</h4><p className="mt-2 text-xs text-[#6e776a]">Generate a picture above to turn this into a visual ad.</p></div>
                </div>}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#779067]">Campaign-ready copy</p><h4 className="mt-1 font-semibold text-[#344332]">{brandName || product}</h4></div><div className="flex gap-2"><button onClick={() => copyAd()} className="rounded-full border border-[#dfe4d9] px-3 py-1.5 text-xs font-semibold text-[#52664a] hover:bg-[#f1f4ed]">Copy text</button><button onClick={() => { const blob = new Blob([result], { type: "text/plain" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "ads.txt"; link.click(); URL.revokeObjectURL(url); }} className="rounded-full border border-[#dfe4d9] px-3 py-1.5 text-xs font-semibold text-[#52664a] hover:bg-[#f1f4ed]">Download copy</button></div></div>
                  <div className="mt-5 grid gap-4">
                    {parsedAds().map((ad, index) => (
                      <article key={`${ad.headline}-${index}`} className="overflow-hidden rounded-[1.5rem] border border-[#dde4d7] bg-white shadow-[0_16px_40px_-30px_rgba(40,55,36,.45)]">
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#30402e]">{brandName || product}</p>
                            <p className="text-[10px] uppercase tracking-[.14em] text-[#899383]">{adType} · sponsored preview</p>
                          </div>
                          <span className="rounded-full bg-[#f0f4ec] px-2.5 py-1 text-[10px] font-semibold text-[#607458]">Ad preview</span>
                        </div>
                        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-[#dfe9d6] via-[#f1eadf] to-[#d8e6e1] sm:aspect-[16/9]">
                          {generatedImage ? <Image src={generatedImage} alt="Generated campaign visual" fill unoptimized className="object-cover" /> : <div className="absolute inset-0 flex items-end p-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#71836a]">{brandName || product}</p><p className="mt-2 max-w-sm text-2xl font-semibold leading-tight tracking-tight text-[#30402e]">{ad.headline}</p><p className="mt-2 text-xs text-[#6e776a]">Generate a campaign picture above to complete this visual.</p></div></div>}
                        </div>
                        <div className="p-5 sm:p-6">
                          <h5 className="text-2xl font-semibold leading-tight tracking-[-.025em] text-[#2d392b]">{ad.headline}</h5>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#596354]">{ad.body}</p>
                          <div className="mt-5 flex flex-col gap-3 border-t border-[#e7ebe2] pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              {safeWebsite && <p className="truncate text-[10px] uppercase tracking-[.12em] text-[#92998d]">{safeWebsite.replace(/^https?:\\/\\//i, "")}</p>}
                              {ad.cta && <p className="mt-1 text-sm font-semibold text-[#35563c]">{ad.cta}</p>}
                            </div>
                            {safeWebsite && <a href={safeWebsite} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-[#35563c] px-5 py-2.5 text-center text-xs font-semibold text-white hover:bg-[#28452f]">Learn more ↗</a>}
                          </div>
                        </div>
                        <div className="border-t border-[#edf0e9] bg-[#fafbf8] px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => copyAd(ad.raw)} className="rounded-full border border-[#dfe4d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#52664a] hover:bg-[#f1f4ed]">Copy ad</button>
                            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#9aa094]">Post to</span>
                            <button type="button" onClick={() => shareAd("facebook", ad.raw)} className="rounded-full border border-[#dfe4d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#52664a]">Facebook ↗</button>
                            <button type="button" onClick={() => shareAd("instagram", ad.raw)} className="rounded-full border border-[#dfe4d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#52664a]">Instagram ↗</button>
                            <button type="button" onClick={() => shareAd("tiktok", ad.raw)} className="rounded-full border border-[#dfe4d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#52664a]">TikTok ↗</button>
                            <button type="button" onClick={() => shareAd("twitter", ad.raw)} className="rounded-full border border-[#dfe4d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#52664a]">X ↗</button>
                            <button type="button" onClick={() => shareAd("linkedin", ad.raw)} className="rounded-full border border-[#dfe4d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#52664a]">LinkedIn ↗</button>
                            <button type="button" onClick={() => shareAd("nextdoor", ad.raw)} className="rounded-full border border-[#dfe4d9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#52664a]">Nextdoor ↗</button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <details className="mt-4 rounded-xl bg-[#f7f9f4] p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-[#65705f]">View raw generated copy</summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-sans text-xs leading-5 text-[#596354]">{result}</pre>
                  </details>
                  <div className="mt-4 border-t border-[#ecefe8] pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#779067]">Share or post your ad</p>
                    <p className="mt-1 text-xs text-[#7b8277]">We’ll copy your ad and open the platform. Review it before publishing.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => shareAd("facebook")} className="rounded-full border border-[#dfe4d9] px-3 py-2 text-xs font-semibold text-[#52664a] hover:bg-[#f1f4ed]">Facebook ↗</button>
                      <button type="button" onClick={() => shareAd("tiktok")} className="rounded-full border border-[#dfe4d9] px-3 py-2 text-xs font-semibold text-[#52664a] hover:bg-[#f1f4ed]">TikTok ↗</button>
                      <button type="button" onClick={() => shareAd("instagram")} className="rounded-full border border-[#dfe4d9] px-3 py-2 text-xs font-semibold text-[#52664a] hover:bg-[#f1f4ed]">Instagram ↗</button>
                      <button type="button" onClick={() => shareAd("twitter")} className="rounded-full border border-[#dfe4d9] px-3 py-2 text-xs font-semibold text-[#52664a] hover:bg-[#f1f4ed]">X ↗</button>
                      <button type="button" onClick={() => shareAd("linkedin")} className="rounded-full border border-[#dfe4d9] px-3 py-2 text-xs font-semibold text-[#52664a] hover:bg-[#f1f4ed]">LinkedIn ↗</button>
                      <button type="button" onClick={() => shareAd("nextdoor")} className="rounded-full border border-[#dfe4d9] px-3 py-2 text-xs font-semibold text-[#52664a] hover:bg-[#f1f4ed]">Nextdoor ↗</button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#ecefe8] pt-4"><span className="text-xs text-[#7b8277]">{audience ? `Made for ${audience}` : "Tailored to your audience"}</span>{safeWebsite && <a href={safeWebsite} target="_blank" rel="noreferrer" className="rounded-full bg-[#35563c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#28452f]">Visit website ↗</a>}</div>
                </div>
              </div>}
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
              <ul className="mt-6 space-y-3 text-sm text-[#61685d]"><li>✓ 10 generations</li><li>✓ Multiple channels and tones</li><li>✓ Saved campaign history</li></ul>
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
    </main>
  );
}

