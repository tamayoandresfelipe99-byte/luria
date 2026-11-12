import { ACCESS_STATUS_UI, PAYMENT_STATE_UI, type AccessStatus, type PaymentState } from "@/lib/domain/access-delivery";

export function PaymentStateBadge({ state }: { state: PaymentState }) {
  const ui = PAYMENT_STATE_UI[state];
  return <span className={`badge ${ui.cls}`}>{ui.label}</span>;
}

export function AccessStatusBadge({ status }: { status: AccessStatus }) {
  const ui = ACCESS_STATUS_UI[status];
  return <span className={`badge ${ui.cls}`}>{ui.label}</span>;
}
