import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!
);

export async function POST() {
  const { userId } = await auth();

  console.log("Creating checkout for user:", userId);
console.log(
  "Stripe key prefix:",
  process.env.STRIPE_SECRET_KEY?.slice(0, 8)
);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const session =
      await stripe.checkout.sessions.create({
        mode: "subscription",

        client_reference_id: userId,

        line_items: [
          {
            price: "price_1TkuMwQOaffISLiSWNXxYR8s",
            quantity: 1,
          },
        ],

        success_url:
          `${process.env.NEXT_PUBLIC_URL}/dashboard?success=true`,

        cancel_url:
          `${process.env.NEXT_PUBLIC_URL}/?canceled=true`,
      });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}