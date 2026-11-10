import "server-only";
import { supabaseServer } from "../supabase/server";
import { customerState, type CustomerSnapshot, type CustomerState } from "../domain/access";
import type { LicenseStatus, PaymentStatus, SubscriptionStatus } from "../domain/states";
import { ELIGIBILITY_VALID_DAYS } from "../domain/eligibility";

export interface CustomerView {
  profile: { full_name: string; email: string; phone: string | null } | null;
  subscription: { status: SubscriptionStatus; current_period_start: string | null; current_period_end: string | null; cancel_at_period_end: boolean; renewal_mode: string } | null;
  license: { status: LicenseStatus; valid_until: string | null } | null;
  payments: { id: string; created_at: string; status: PaymentStatus; amount_cents: number; provider: string; method: string | null; reference: string }[];
  state: CustomerState;
  eligibilityVerified: boolean;
  marketingGranted: boolean;
  hasFuturePeriod: boolean;
}

/** Todo con el cliente del usuario: RLS garantiza que solo lee lo propio (A10). */
export async function loadCustomerView(now = new Date()): Promise<CustomerView> {
  const sb = await supabaseServer();
  const [profile, sub, lic, pays, elig, mk, periods] = await Promise.all([
    sb.from("profiles").select("full_name, email, phone").maybeSingle(),
    sb.from("subscriptions").select("status, current_period_start, current_period_end, cancel_at_period_end, renewal_mode").maybeSingle(),
    sb.from("licenses").select("status, valid_until").maybeSingle(),
    sb.from("payments").select("id, created_at, status, amount_cents, provider, method, orders!inner(reference)").order("created_at", { ascending: false }).limit(24),
    sb.from("eligibility_checks").select("result, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("consents").select("granted, created_at").eq("purpose", "marketing").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("subscription_periods").select("period_start, refunded").gt("period_start", now.toISOString()).eq("refunded", false).limit(1),
  ]);
  const payments = ((pays.data ?? []) as unknown as (CustomerView["payments"][number] & { orders: { reference: string } })[]).map((p) => ({ ...p, reference: p.orders.reference }));
  const s = sub.data as CustomerView["subscription"];
  const l = lic.data as CustomerView["license"];
  const snapshot: CustomerSnapshot = {
    lastPaymentStatus: payments[0]?.status ?? null,
    subscription: s ? { status: s.status, currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end) : null, cancelAtPeriodEnd: s.cancel_at_period_end } : null,
    license: l ? { status: l.status, validUntil: l.valid_until ? new Date(l.valid_until) : null } : null,
  };
  const e = elig.data as { result: string; created_at: string } | null;
  return {
    profile: profile.data as CustomerView["profile"],
    subscription: s,
    license: l,
    payments,
    state: customerState(snapshot, now),
    eligibilityVerified: !!e && e.result === "verificado" && now.getTime() - new Date(e.created_at).getTime() < ELIGIBILITY_VALID_DAYS * 86_400_000,
    marketingGranted: !!(mk.data as { granted: boolean } | null)?.granted,
    hasFuturePeriod: (periods.data ?? []).length > 0,
  };
}
