import Link from "next/link";

export default function PayPalCancelPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] px-5 py-16 text-[#20231f]">
      <section className="w-full max-w-lg rounded-3xl border border-[#e8eae3] bg-white p-8 text-center shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">PayPal checkout</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Checkout wasn’t completed.</h1>
        <p className="mt-4 text-sm leading-6 text-[#73796e]">You can return to AdSurvey Studio and choose another payment option.</p>
        <Link href="/#pricing" className="mt-7 inline-flex rounded-full bg-[#35563c] px-6 py-3 text-sm font-semibold text-white hover:bg-[#28452f]">
          Return to pricing
        </Link>
      </section>
    </main>
  );
}

