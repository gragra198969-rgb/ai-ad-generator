import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/app/lib/db";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook Error:", err.message);

    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  console.log("EVENT TYPE:", event.type);

  if (event.type === "checkout.session.completed") {
    const session =
      event.data.object as Stripe.Checkout.Session;

    console.log("================================");
    console.log("SESSION:", session);
    console.log(
      "CLIENT REF:",
      session.client_reference_id
    );
    console.log(
      "EMAIL:",
      session.customer_details?.email
    );
    console.log(
      "CUSTOMER:",
      session.customer
    );
    console.log("================================");

    const clerkUserId =
      session.client_reference_id;

    if (!clerkUserId) {
      console.log(
        "No client_reference_id found in checkout session."
      );

      return NextResponse.json({
        received: true,
      });
    }

    try {
      await sql`
        UPDATE users
        SET ads_limit = 1000
        WHERE clerk_user_id = ${clerkUserId}
      `;

      console.log(
        "Upgraded user:",
        clerkUserId
      );
    } catch (dbError) {
      console.error(
        "Database update failed:",
        dbError
      );
    }
  }

  return NextResponse.json({
    received: true,
  });
}