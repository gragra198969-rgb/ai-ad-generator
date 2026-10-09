import Link from "next/link";

export default function FAQPage() {
  const questions = [
    {
      question: "What does the ad studio create?",
      answer: "It creates multiple advertising copy ideas from your product, audience, channel, and tone. Review and edit every idea before you publish it.",
    },
    {
      question: "Do I need an account?",
      answer: "Yes. Sign in to create ads, manage your credits, and keep a record of your saved campaigns.",
    },
    {
      question: "How does the free plan work?",
      answer: "The free plan includes 10 credits. One ad-generation batch uses 1 credit, regardless of whether it returns 5, 10, or 20 copy ideas. Each generated image also uses 1 credit.",
    },
    {
      question: "What is included in Pro?",
      answer: "Pro is $9.99 per month and includes 150 credits per billing cycle. An ad-generation batch or one generated image uses 1 credit. The new plan applies to new subscriptions after checkout is configured; existing subscribers keep their current provider terms.",
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
