import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, {
    apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
  });
}

const PLAN_CLIPS: Record<string, number> = {
  free: 3,
  pro: 30,
  business: 9999,
};

function getPlanFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return "business";
  return "free";
}

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    res.status(400).send("Webhook signature verification failed");
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.uid;
      if (!uid) break;

      const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0]?.price.id || "";
      const plan = getPlanFromPriceId(priceId);

      await db.doc(`users/${uid}`).update({
        plan,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        "usage.clipsLimit": PLAN_CLIPS[plan] || 3,
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price.id || "";
      const plan = getPlanFromPriceId(priceId);

      // Find user by subscription ID
      const users = await db
        .collection("users")
        .where("stripeSubscriptionId", "==", subscription.id)
        .get();

      for (const userDoc of users.docs) {
        await userDoc.ref.update({
          plan,
          "usage.clipsLimit": PLAN_CLIPS[plan] || 3,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const users = await db
        .collection("users")
        .where("stripeSubscriptionId", "==", subscription.id)
        .get();

      for (const userDoc of users.docs) {
        await userDoc.ref.update({
          plan: "free",
          stripeSubscriptionId: null,
          "usage.clipsLimit": 3,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const users = await db
        .collection("users")
        .where("stripeCustomerId", "==", customerId)
        .get();

      for (const userDoc of users.docs) {
        console.warn(`Payment failed for user ${userDoc.id}`);
      }
      break;
    }
  }

  res.json({ received: true });
});
