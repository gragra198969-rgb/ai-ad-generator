import Stripe from "stripe";
import { applyCreditEvent } from "@/app/lib/billing-security";

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  try {
    // A completed checkout is not proof of payment. Initial and renewal credits
    // both come from paid invoices, keyed by invoice ID to prevent double grants.
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const userId = invoice.parent?.subscription_details?.metadata?.clerk_user_id;
      if (userId && invoice.status === "paid" && invoice.amount_paid > 0) {
        await applyCreditEvent("stripe", `invoice:${invoice.id}`, userId, true);
      }
    }
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.clerk_user_id;
      if (userId) await applyCreditEvent("stripe", event.id, userId, false);
    }
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "Webhook processing failed. Please retry." }, { status: 500 });
  }
}
