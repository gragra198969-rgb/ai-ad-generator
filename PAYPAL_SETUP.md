# PayPal subscription checkout setup

This app keeps Stripe card checkout and adds a separate PayPal subscription
checkout. PayPal payments are processed by PayPal and settle to the PayPal
merchant account. They do not change the payout destination for Stripe charges.

## PayPal account setup

1. Use a PayPal Business account and create an app in the PayPal Developer
   Dashboard. Start with a Sandbox app and its Sandbox buyer and seller accounts.
2. Create a PayPal product and a monthly subscription plan for USD 19.99. Set
   the plan's product/description and billing cycle to match the Pro offer.
3. Add a webhook for the app at
   `https://ai-ad-generator-nu.vercel.app/api/paypal/webhook` with these event
   types: `PAYMENT.SALE.COMPLETED`, `BILLING.SUBSCRIPTION.CANCELLED`,
   `BILLING.SUBSCRIPTION.SUSPENDED`, and `BILLING.SUBSCRIPTION.EXPIRED`.
4. Copy the app's Client ID and Secret, the plan ID, and the created webhook ID
   into Vercel's production environment variables. Keep the secret private.

## Vercel environment variables

Set these for Preview with Sandbox credentials first, then Production with live
credentials after the Sandbox flow has passed:

- `PAYPAL_MODE`: `sandbox` for testing, `live` for real customer payments.
- `PAYPAL_CLIENT_ID`: Client ID for the selected PayPal app.
- `PAYPAL_CLIENT_SECRET`: Secret for the selected PayPal app.
- `PAYPAL_PLAN_ID`: monthly USD 19.99 Pro plan ID.
- `PAYPAL_WEBHOOK_ID`: ID of the webhook configured for the selected app.
- `NEXT_PUBLIC_PAYPAL_CHECKOUT_ENABLED`: `true` to show the PayPal checkout
  button after the PayPal environment is configured.

Redeploy after changing Vercel environment variables. Sandbox credentials and
webhook IDs must not be mixed with live credentials.

## What the integration does

- Creates a PayPal subscription for the signed-in user and redirects them to
  PayPal for approval.
- Grants the Pro allowance after PayPal reports a completed subscription
  payment, and resets the monthly allowance on later completed payments.
- Downgrades access after PayPal reports cancellation, suspension, or expiry.
- Verifies PayPal webhook signatures and deduplicates repeated event deliveries.

