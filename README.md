# AdSurvey Studio

AdSurvey Studio is the product built in the `ai-ad-generator` repository: a Next.js app for generating ad copy, saving campaign history, and subscribing to Pro through Stripe or PayPal. The October 2026 refresh introduces the AdSurvey Studio interface; customer surveys are an illustrative preview and are not implemented.

## What is implemented

- Clerk sign-up/sign-in modals and account controls.
- OpenAI ad copy for Facebook, Google, email, TikTok, Instagram, X/Twitter, and LinkedIn, with brand, audience, benefit, website, tone, and quantity inputs.
- Neon/PostgreSQL generation history, a searchable dashboard, and deletion.
- Copy-to-clipboard and plain-text download (`ads.txt`).
- Stripe-hosted card subscription checkout and separate PayPal subscription checkout.
- An image-generation API using `gpt-image-1`; it is not connected to the current homepage UI.

PDF export, survey creation/response collection, and a separate projects system are not implemented. Saved work currently consists of ad-generation records.

**Current deployment limitations:** saved ads are not scoped to their owner, and the image endpoint has no authentication or credit check. Review [Current limitations](#current-limitations) before treating this as a production-ready multi-user SaaS.

## Stack and project map

Next.js 16.2.9 (App Router), React 19.2.4, TypeScript, Tailwind CSS 4, Clerk, `@neondatabase/serverless`, OpenAI SDK, and Stripe SDK. PayPal uses server-side REST requests.

| Location | Purpose |
| --- | --- |
| `app/page.tsx` | Landing page, ad studio, pricing, checkout buttons, recent work |
| `app/layout.tsx`, `middleware.ts` | Clerk provider and middleware |
| `app/dashboard/page.tsx` | Saved ads, search, deletion, allowance display |
| `app/api/generate/route.ts` | Ad copy, credit usage, saving |
| `app/api/generate-image/route.ts` | Image generation |
| `app/api/user/route.ts`, `app/api/ads/route.ts` | Account allowance and saved-ad APIs |
| `app/lib/db.ts` | Neon connection |
| `app/api/stripe/` | Stripe checkout and webhook |
| `app/lib/paypal.ts`, `app/api/paypal/` | PayPal API helpers, checkout, webhook |
| `app/paypal/return/`, `app/paypal/cancel/` | PayPal return pages |
| [PAYPAL_SETUP.md](PAYPAL_SETUP.md) | Additional PayPal setup notes |

## Local setup

Prerequisites: Git, Node.js 20.9 or newer (the locked Next.js package's minimum), npm, a Clerk application, a Neon database, an OpenAI API project with billing/model access, and Stripe test credentials. PayPal is optional until enabled.

1. Clone the repository and install the locked dependencies:

   ```bash
   git clone https://github.com/gragra198969-rgb/ai-ad-generator.git
   cd ai-ad-generator
   npm ci
   ```

2. Create `.env.local` in that project folder using the template below. Replace placeholders with your own values. There is no committed environment template.
3. Initialize the database using the SQL below.
4. Configure Clerk and the payment providers you intend to test.
5. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

On Windows, run these commands in Command Prompt from the project directory (for example, `C:\ai-ad-generator`). If PowerShell blocks `npm.ps1`, use `npm.cmd ci` and `npm.cmd run dev`, or use Command Prompt.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm start` | Serve a completed production build |

Restart the development server after changing environment variables. OpenAI, Stripe, and Neon clients are initialized at module load, so missing configuration can affect route loading/builds even before those features are used. The layout also loads Geist through `next/font/google`, which requires font access during a build.

## Environment variables

Keep `.env.local` out of Git. Only the variables prefixed with `NEXT_PUBLIC_` are intended for browser use. Never add that prefix to secrets.

```dotenv
# Clerk development instance
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
CLERK_SECRET_KEY=sk_test_REPLACE_ME

# Neon PostgreSQL connection string
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require

# OpenAI server-side API key
OPENAI_API_KEY=REPLACE_ME

# Exact app origin, without a trailing slash
NEXT_PUBLIC_URL=http://localhost:3000

# Stripe test configuration
STRIPE_SECRET_KEY=sk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME

# Optional PayPal Sandbox configuration
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=REPLACE_ME
PAYPAL_CLIENT_SECRET=REPLACE_ME
PAYPAL_PLAN_ID=P-REPLACE_ME
PAYPAL_WEBHOOK_ID=REPLACE_ME
NEXT_PUBLIC_PAYPAL_CHECKOUT_ENABLED=false
```

| Variable | Required for / behavior |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Browser Clerk setup; pair with the same instance's secret |
| `CLERK_SECRET_KEY` | Server-side Clerk authentication |
| `DATABASE_URL` | Neon queries for generation, account usage, history, and billing |
| `OPENAI_API_KEY` | Text and image generation |
| `NEXT_PUBLIC_URL` | Absolute origin used for both providers' checkout return/cancel URLs |
| `STRIPE_SECRET_KEY` | Stripe server client and checkout |
| `STRIPE_WEBHOOK_SECRET` | Signature verification for the receiving Stripe endpoint |
| `PAYPAL_MODE` | Only exact `live` selects live; every other value defaults to Sandbox |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Server-side credentials for the selected PayPal app/environment |
| `PAYPAL_PLAN_ID` | Subscription plan created in that same environment |
| `PAYPAL_WEBHOOK_ID` | ID of the webhook registered for that PayPal app |
| `NEXT_PUBLIC_PAYPAL_CHECKOUT_ENABLED` | Only exact `true` shows the PayPal button; this does not disable the API |

There is currently **no `STRIPE_PRICE_ID` environment variable**. The checkout route hardcodes `price_1TkuMwQOaffISLiSWNXxYR8s`. Replace that literal in `app/api/stripe/checkout/route.ts` with a recurring price from your Stripe account and selected mode, or implement environment-based price selection separately. Its actual amount/mode cannot be inferred from the ID. No Stripe publishable key or browser-side PayPal client ID is used by the current redirect-based checkout.

## Database requirements

The repository has no migration command or committed schema for the core tables. `app/lib/db.ts` passes `DATABASE_URL` to the Neon serverless driver.

For a **new, empty development database**, run this minimal schema in the Neon SQL editor. It is derived from the current queries; it is not a migration for an existing database. Inspect existing tables before making changes.

```sql
CREATE TABLE IF NOT EXISTS users (
  clerk_user_id TEXT PRIMARY KEY,
  ads_used INTEGER NOT NULL DEFAULT 0,
  ads_limit INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS ads (
  id SERIAL PRIMARY KEY,
  brand_name TEXT,
  product TEXT,
  audience TEXT,
  benefit TEXT,
  website TEXT,
  tone TEXT,
  ad_type TEXT,
  ad_count INTEGER,
  generated_ads TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The unique/primary key on `users.clerk_user_id` is required for billing and generation `ON CONFLICT` statements. The generation route explicitly inserts 0 used and a 10-generation limit for new accounts, so existing databases with an older default also give new users 10 credits. Existing account balances are preserved. `ads.id` supports ordering/deletion and `created_at` is displayed by the dashboard.

PayPal creates these additional objects at runtime:

- `paypal_subscriptions`: subscription ID primary key, Clerk user ID, plan ID, approval URL, status, and update timestamp.
- `paypal_webhook_events`: event ID primary key, receipt timestamp, and processing timestamp.
- A partial unique index allowing one `APPROVAL_PENDING` subscription per user.

The database role therefore needs table/index creation permissions in addition to normal reads/writes, unless those exact objects are provisioned in advance from the PayPal route definitions. Use a separate development/preview database so test payment events cannot change production allowances.

## Authentication and ad generation

The root layout wraps the app in `ClerkProvider`. The homepage uses Clerk modal sign-in/sign-up and `useUser`. Configure the corresponding development or production Clerk instance for your app's domain.

`middleware.ts` installs `clerkMiddleware()`; it does not globally require sign-in. The text-generation, account, saved-ad, and checkout handlers explicitly check `auth()` and return HTTP 401 without a user. Payment webhooks authenticate using provider signatures instead of a Clerk session. There is no Clerk webhook that provisions database users: text generation inserts a user on demand, billing can upsert one, and `GET /api/user` returns a default 0/10 allowance if none exists.

`POST /api/generate` accepts `product`, `audience`, `benefit`, `website`, `tone`, `adType`, `adCount`, and `brandName`. Product and audience are required. It requests copy from OpenAI Chat Completions using `gpt-4.1-mini`, bounds the requested count to 1–20 (default 5), increments usage, inserts the generated batch into `ads`, and returns `{ result }`.

**One generation request consumes one credit**, whether it requests 5, 10, or 20 ad ideas. Free users default to 10 generations; Pro payment events set the allowance to 1,000 and reset usage to zero. There is no scheduled monthly reset for free users. Pro renewal resets depend on payment webhooks.

`POST /api/generate-image` accepts product, audience, and benefit, requests a 1024×1024 image from `gpt-image-1`, and returns a PNG data URL. It currently has no sign-in requirement, usage deduction, or database persistence.

## Stripe billing

1. In your Stripe test environment, create a recurring USD 19.99/month price matching the displayed Pro offer. Replace the hardcoded checkout price with its ID.
2. Set the Stripe secret key, webhook signing secret, and `NEXT_PUBLIC_URL`.
3. Register `https://YOUR_HOST/api/stripe/webhook` for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.deleted`
4. Sign in and select **Subscribe by card**.

Checkout creates a hosted subscription session with the Clerk ID in `client_reference_id` and subscription metadata. Success returns to `/dashboard?success=true`; cancellation returns to `/?canceled=true`. Redirects alone do not update credits.

The signature-verified webhook grants 1,000/reset usage on checkout completion, resets to 1,000 on a paid invoice using subscription metadata, and resets to 10 on subscription deletion. Payment failures and subscription updates are not handled.

For local testing with the Stripe CLI installed/authenticated:

```bash
stripe listen --events checkout.session.completed,invoice.paid,customer.subscription.deleted --forward-to localhost:3000/api/stripe/webhook
```

Use the listener's signing secret in local `STRIPE_WEBHOOK_SECRET` and restart the app. Complete an actual test checkout while signed in so events contain the Clerk ID; generic fixtures may not include the required metadata.

## PayPal billing

PayPal is a separate subscription/payment provider. PayPal receipts settle to the PayPal merchant account; they do not change Stripe payout settings.

1. Start with a PayPal Business Sandbox app and Sandbox seller/buyer accounts.
2. Create a product and an active recurring USD 19.99/month subscription plan in Sandbox.
3. Set the matching Client ID, secret, plan ID, `PAYPAL_MODE=sandbox`, and app origin.
4. Register a publicly reachable HTTPS webhook at `https://YOUR_HOST/api/paypal/webhook` for exactly:
   - `PAYMENT.SALE.COMPLETED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
5. Set its webhook ID, then set `NEXT_PUBLIC_PAYPAL_CHECKOUT_ENABLED=true` and rebuild/redeploy.
6. Sign in, select **Subscribe with PayPal**, and approve using a Sandbox buyer.

Checkout attaches the Clerk ID as `custom_id`, rejects accounts whose allowance is already at least 1,000, and reuses pending approval URLs for up to 30 minutes. Return and cancellation pages are `/paypal/return` and `/paypal/cancel`; neither page grants Pro.

The webhook verifies the signature through PayPal, fetches the subscription, checks its plan ID and Clerk `custom_id`, and tracks processed event IDs. A completed sale grants/resets 1,000 generations. Cancellation, suspension, or expiry resets the user to 10 when the fetched subscription status confirms it. Approval or activation alone does not grant credits.

For local webhook testing, expose the local server through a public HTTPS tunnel and register that URL with the Sandbox app, or use a Sandbox-configured preview deployment. Set `NEXT_PUBLIC_URL` to the reachable app origin and use the webhook ID for that exact registered endpoint.

## Sandbox versus live

| Setting | Local / preview testing | Production payments |
| --- | --- | --- |
| Clerk | Development instance keys | Production instance keys/domain configuration |
| Database | Isolated development/preview database | Production database |
| Stripe | Test/Sandbox secret, recurring price, endpoint secret from the same environment | Live secret, live recurring price, live endpoint secret |
| PayPal | `PAYPAL_MODE=sandbox`; Sandbox app, plan, webhook, buyer | `PAYPAL_MODE=live`; live app, plan, webhook |
| `NEXT_PUBLIC_URL` | Local origin or the actual preview/tunnel origin | Canonical HTTPS production origin |

Changing only `PAYPAL_MODE` is insufficient: replace all PayPal credentials, plan ID, and webhook ID together. Stripe also requires changing the hardcoded price when switching accounts/modes. Test configuration for one provider does not put the other provider into test mode. Sandbox billing does not make OpenAI requests free; generation still uses the configured OpenAI project.

## Deployment on Vercel

1. Import this repository, use the **Next.js** framework preset and repository root, and configure `main` as the production branch.
2. Use a Node runtime compatible with the locked dependencies, `npm ci` for installation, and `npm run build` for the build. Keep the default Next.js output settings.
3. Add the environment variables above to the appropriate **Development**, **Preview**, and **Production** scopes. Local `.env.local` is not uploaded from Git.
4. Initialize the target Neon database and configure Clerk for the deployment domain.
5. Set `NEXT_PUBLIC_URL` to the actual origin for each environment. Register both providers' webhooks against the matching reachable deployment and configure their matching secrets/IDs.
6. Deploy first with test/Sandbox payments. Verify sign-in, generation, history, and webhook-driven allowance changes.
7. Configure the complete live payment settings for Production only after testing, then redeploy.

Redeploy after environment changes; public variables, including PayPal button visibility, are embedded during the build. Preview deployment protection must allow payment providers to reach webhook routes. Use a stable preview domain or update the origin/webhook registration when the preview URL changes.

## Verification and troubleshooting

Run `npm run lint` and `npm run build` with configuration present. No automated test script is currently defined.

For an end-to-end check, sign in with a test user, generate a batch, confirm usage increases by one, view it in the dashboard, and download the text. Test each payment provider independently: confirm the webhook changes `GET /api/user` to a 1,000 allowance, a later paid renewal resets usage, and subscription cancellation/deletion returns it to 10. Refresh the dashboard after webhook processing.

| Symptom | Check |
| --- | --- |
| `npm` cannot find `package.json` | Run commands inside the cloned project directory |
| Clerk sign-in fails / API returns 401 | Matching Clerk keys, domain configuration, and an active session |
| Missing credentials during route loading/build | OpenAI, Stripe, Clerk, and database environment configuration |
| Database relation/column errors | Core schema, defaults, unique Clerk ID, connection string, PayPal DDL permissions |
| OpenAI generation error | API key, project billing/quota, model access, and server logs |
| Stripe “No such price” | Hardcoded price belongs to the configured Stripe account and mode |
| PayPal button is absent | Public flag is exact `true` and the app was rebuilt |
| Checkout succeeds but credits stay unchanged | Webhook URL, delivery logs, matching signing configuration, database writes, and Clerk metadata |
| PayPal verification/configuration errors | App, plan, webhook ID, credentials, and mode all match |
| Next.js middleware deprecation warning | Repository still uses `middleware.ts`; migration to the newer convention is separate work |

## Current limitations

These are behaviors of the current code, not setup options:

- **Saved-ad ownership:** generation does not store a Clerk user ID in `ads`; listing returns the latest 50 rows globally, and deletion filters only by ad ID. Any signed-in user can access/delete shared records. Owner-scoped persistence and authorization are needed for private customer work.
- **Image API access:** the image route has no authentication, rate limit, or credit enforcement.
- **Credit accounting:** allowance checks, usage increments, and ad inserts are separate operations. Concurrent requests can exceed a limit, and a save failure after the increment can still consume a credit.
- **Billing lifecycle:** Stripe has no event deduplication and checkout-completion database errors are logged but acknowledged. Replayed events can reset usage. PayPal tracks processed events, but its event processing and allowance updates are not one transaction.
- **Multiple subscriptions:** Stripe checkout does not guard against an existing Pro subscription. Both providers write the same allowance, with no combined subscription reconciliation; a cancellation from one can downgrade an account still paying through the other. No in-app billing portal or subscription-cancellation API exists.
- **Allowance display:** the dashboard checks `creditsLeft > 1000` for its Pro label, so a normal 1,000-credit Pro account can be labeled Free. Use account values and provider records to verify billing rather than that label.
- **Feature scope:** history retrieval is limited to 50 records; surveys and PDF export remain unimplemented. Free monthly resets are not scheduled.
