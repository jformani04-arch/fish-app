/**
 * RevenueCat Webhook — Supabase Edge Function
 *
 * Receives subscription lifecycle events from RevenueCat and keeps
 * the Supabase `profiles` table in sync with the current entitlement state.
 *
 * Setup:
 *   1. Deploy: supabase functions deploy revenuecat-webhook
 *   2. Set secret: supabase secrets set REVENUECAT_WEBHOOK_SECRET=<your-secret>
 *   3. In RevenueCat dashboard → Apps → Webhooks:
 *        URL: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
 *        Authorization header value: <same secret as above>
 *   4. Enable all event types (at minimum: INITIAL_PURCHASE, RENEWAL,
 *      CANCELLATION, EXPIRATION, BILLING_ISSUE_DETECTED_CURRENT,
 *      BILLING_ISSUE_RESOLVED, UNCANCELLATION, PRODUCT_CHANGE)
 *
 * The app_user_id sent by RevenueCat must equal the Supabase user UUID.
 * This is guaranteed by calling Purchases.logIn(userId) in the app after login.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RCEvent {
  type: string;
  app_user_id: string;
  original_app_user_id: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[];
  expiration_at_ms?: number | null;
  purchased_at_ms?: number;
  period_type?: string;
  store?: string;
  environment?: string;
  id?: string;
  currency?: string;
  price?: number;
}

interface RCWebhookPayload {
  api_version: string;
  event: RCEvent;
}

// ─── Event classification ─────────────────────────────────────────────────────

/** Events that grant or extend Pro access. */
const PRO_GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "BILLING_ISSUE_RESOLVED",
  "SUBSCRIBER_ALIAS",        // Alias merges — keep existing entitlement
  "NON_RENEWING_PURCHASE",  // One-time purchases if ever used
]);

/** Events that revoke Pro access immediately. */
const PRO_REVOKE_EVENTS = new Set([
  "EXPIRATION",
]);

/**
 * Events where the user keeps Pro access until their period ends.
 * We do NOT revoke on CANCELLATION — the subscription is still active
 * until the expiration date. RevenueCat will send EXPIRATION when it ends.
 */
const GRACE_EVENTS = new Set([
  "CANCELLATION",
  "BILLING_ISSUE_DETECTED_CURRENT",
]);

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Validate shared secret (set in RevenueCat webhook Authorization header)
  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  if (!webhookSecret || authHeader !== webhookSecret) {
    console.error("[rc-webhook] Unauthorized request — invalid authorization header");
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse body
  let payload: RCWebhookPayload;
  try {
    payload = await req.json() as RCWebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = payload.event;
  if (!event?.type || !event?.app_user_id) {
    return new Response("Missing event.type or event.app_user_id", { status: 400 });
  }

  // Skip sandbox events in production (optional — comment out to receive sandbox events)
  if (event.environment === "SANDBOX" && Deno.env.get("REVENUECAT_ALLOW_SANDBOX") !== "true") {
    console.log(`[rc-webhook] Ignoring sandbox event: ${event.type}`);
    return new Response("OK (sandbox ignored)", { status: 200 });
  }

  const userId = event.app_user_id;
  const eventType = event.type;
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

  console.log(`[rc-webhook] ${eventType} for user ${userId.slice(0, 8)}… expires: ${expiresAt?.toISOString() ?? "none"}`);

  // Initialise Supabase client with service role (can write subscription fields)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Log the event for audit trail
  const { error: logError } = await supabase.from("subscription_events").insert({
    user_id: userId,
    event_type: eventType,
    product_id: event.product_id ?? null,
    entitlement_ids: event.entitlement_ids ?? [],
    store: event.store ?? null,
    environment: event.environment ?? null,
    raw: payload.event,
  });
  if (logError) {
    // Non-fatal — log and continue
    console.warn("[rc-webhook] Failed to log event:", logError.message);
  }

  // Determine the entitlement action
  if (PRO_GRANT_EVENTS.has(eventType)) {
    await setProStatus(supabase, userId, true, expiresAt);
  } else if (PRO_REVOKE_EVENTS.has(eventType)) {
    await setProStatus(supabase, userId, false, null);
  } else if (GRACE_EVENTS.has(eventType)) {
    // Keep Pro active until expiration — just update the expiration timestamp.
    // RevenueCat sends EXPIRATION when the period actually ends.
    await updateExpiresAt(supabase, userId, expiresAt);
    console.log(`[rc-webhook] ${eventType}: keeping Pro active until ${expiresAt?.toISOString() ?? "expiration"}`);
  } else {
    // Unknown event type — log and ignore
    console.log(`[rc-webhook] Unhandled event type: ${eventType}`);
  }

  return new Response("OK", { status: 200 });
});

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function setProStatus(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  isPro: boolean,
  expiresAt: Date | null
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      is_pro: isPro,
      subscription_tier: isPro ? "pro" : "free",
      subscription_provider: isPro ? "revenuecat" : null,
      subscription_expires_at: expiresAt ? expiresAt.toISOString() : null,
    })
    .eq("id", userId);

  if (error) {
    console.error(`[rc-webhook] Failed to update profile for ${userId}:`, error.message);
  } else {
    console.log(`[rc-webhook] Profile updated: is_pro=${isPro} for ${userId.slice(0, 8)}…`);
  }
}

async function updateExpiresAt(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  expiresAt: Date | null
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_expires_at: expiresAt ? expiresAt.toISOString() : null,
    })
    .eq("id", userId);

  if (error) {
    console.error(`[rc-webhook] Failed to update expires_at for ${userId}:`, error.message);
  }
}
