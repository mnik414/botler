// Persian formatting helpers

export function toFa(n: number | string | undefined | null): string {
  if (n === undefined || n === null) return "";
  const fa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/\d/g, (d) => fa[+d]);
}

export function toEn(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function formatToman(n: number): string {
  return toFa(n.toLocaleString("en-US")) + " تومان";
}

export function formatNumber(n: number): string {
  return toFa(n.toLocaleString("en-US"));
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return toFa((n / 1_000_000).toFixed(1)) + "م";
  if (n >= 1_000) return toFa((n / 1_000).toFixed(1)) + "ه";
  return toFa(n);
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  try {
    return new Intl.DateTimeFormat("fa-IR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export function timeAgo(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "همین حالا";
  if (min < 60) return toFa(min) + " دقیقه پیش";
  const hr = Math.floor(min / 60);
  if (hr < 24) return toFa(hr) + " ساعت پیش";
  const day = Math.floor(hr / 24);
  return toFa(day) + " روز پیش";
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "مدیر سیستم",
  business_owner: "صاحب کسب‌وکار",
  operator: "اپراتور",
  end_user: "کاربر نهایی",
};

export const LEAD_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "جدید", color: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  contacted: { label: "در حال پیگیری", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  converted: { label: "تبدیل شده", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  lost: { label: "از دست رفته", color: "bg-rose-500/15 text-rose-600 border-rose-500/30" },
};

export const CONVO_STATUS: Record<string, { label: string; color: string }> = {
  ai: { label: "پاسخ هوش مصنوعی", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  handoff: { label: "انتقال به اپراتور", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  closed: { label: "بسته شده", color: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30" },
};

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  store: "فروشگاه",
  restaurant: "رستوران",
  doctor: "پزشک",
  clinic: "کلینیک",
  lawyer: "وکیل",
  travel: "آژانس گردشگری",
  hotel: "هتل",
  academy: "آموزشگاه",
  realestate: "مشاور املاک",
  other: "سایر",
};
