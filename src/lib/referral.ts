// Referral program constants and policy.
//
// Policy (deliberately conservative — see docs/AUDIT.md):
// - Referrers are credited on signup, not on payment. Self-referrals are
//   rejected by comparing the new owner email against the referrer's users.
// - The invited business receives a welcome credit tracked on its own
//   Referral row. Credits are informational until an admin redemption flow
//   exists; they are never silently spendable.

export const REFERRAL_SIGNUP_CREDITS = 100_000;
export const REFERRAL_SIGNUP_COMMISSION = 50_000;
export const REFERRAL_WELCOME_CREDITS = 100_000;
export const REFERRAL_COMMISSION_PERCENT = 10;
