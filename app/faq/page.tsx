import Link from "next/link";

export default function FAQPage() {
  const questions = [
    {
      question: "What does the ad studio create?",
      answer: "It creates multiple advertising copy ideas from your product, audience, channel, and tone. Review and edit every idea before you publish it.",
    },
    {
      question: "Do I need an account?",
      answer: "Yes. Sign in to generate ads, keep a record of your saved campaigns, and see your remaining monthly generations.",
    },
    {
      question: "How does the free plan work?",
      answer: "The free plan includes up to 10 generations. Each generation can return 5, 10, or 20 copy ideas. Your available balance appears in the ad studio after you sign in.",
    },
    {
      question: "What is included in Pro?",
      answer: "Pro is listed at $19.99 per month and includes 1,000 generations each billing month. Your limit resets after Stripe confirms each monthly payment; when the subscription ends, the account returns to the free limit. Review the subscription details in Stripe checkout before subscribing.",
    },
    {
      question: "Can I create customer surveys today?",
      answer: "Not yet. Survey creation and response collection are in development. The survey section on the home page is a concept preview, not a live survey tool.",
    },
    {
      question: "Will the AI guarantee better results?",
      answer: "No. AI suggestions are a starting point, not a promise of sales or campaign performance. Check every claim and adapt the copy to your product and advertising rules.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#fbfaf8] px-5 py-16 text-[#20231f] sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold text-[#55734c] hover:underline" href="/">← Back to AdSurvey Studio</Link>
        <p className="mt-10 text-xs font-semibold uppercase tracking-[.18em] text-[#779067]">A few helpful answers</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Frequently asked questions</h1>
        <p className="mt-4 text-base leading-7 text-[#73776e]">What the studio can do today, what’s still taking shape, and how plans work.</p>
        <div className="mt-10 divide-y divide-[#e8eae3] rounded-3xl border border-[#e8eae3] bg-white px-6 sm:px-8">
          {questions.map(({ question, answer }) => (
            <details key={question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-[#30392d] marker:hidden">
                {question}<span className="text-lg text-[#779067] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#747a70]">{answer}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-[#777c72]">Still have a question? Email support details will be added here soon.</p>
      </div>
    </main>
  );
}
