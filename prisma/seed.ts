#!/usr/bin/env npx tsx
/**
 * CLI seed script for the AI Receptionist Platform.
 * Usage: npm run db:seed
 * 
 * Seeds the database with demo plans, tenants, users, and sample data.
 * Only seeds if the database is empty (checks if any plans exist).
 * Pass --force to re-seed from scratch (wipes all data first).
 */
import { PrismaClient } from "@prisma/client";
import * as path from "path";
import * as fs from "fs";
import bcrypt from "bcryptjs";

// Determine the DB path — look for .env or use default
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/DATABASE_URL=file:(.+)/);
  if (match) {
    const dbPath = match[1].trim();
    // If path is absolute, ensure directory exists
    if (dbPath.startsWith("/")) {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
}

const db = new PrismaClient({
  log: ["error", "warn"],
});

interface BusinessTypeInfo {
  code: string;
  label: string;
  icon: string;
  prompt: string;
  category: string;
  sampleFaqs: { q: string; a: string }[];
}

interface KnowledgeChunk {
  text: string;
  keywords: string[];
}

const BUSINESS_TYPES: BusinessTypeInfo[] = [
  {
    code: "store",
    label: "فروشگاه",
    icon: "ShoppingBag",
    category: "shop",
    prompt: `تو یک منشی هوشمند برای یک فروشگاه هستی. وظایف تو:
- پاسخ به سوالات درباره محصولات، قیمت‌ها و موجودی
- راهنمایی customers درباره سفارش و تحویل
- اطلاع‌رسانی درباره تخفیف‌ها و رویدادهای فروش
- پیگیری سفارش‌ها و وضعیت ارسال`,
    sampleFaqs: [
      { q: "ساعات کاری فروشگاه چقدر است؟", a: "فروشگاه از شنبه تا پنجشنبه ۹ صبح تا ۹ شب و جمعه‌ها ۱۰ صبح تا ۶ بعدازظهر باز است." },
      { q: "آیا امکان خرید آنلاین وجود دارد؟", a: "بله، می‌توانید از طریق وب‌سایت یا اینستاگرام سفارش خود را ثبت کنید." },
      { q: "هزینه ارسال چقدر است؟", a: "ارسال در تهران ۴۵ هزار تومان و برای شهرستان‌ها بر اساس وزن و مسافت محاسبه می‌شود." },
    ],
  },
  {
    code: "restaurant",
    label: "رستوران و کافه",
    icon: "UtensilsCrossed",
    category: "food",
    prompt: `تو یک منشی هوشمند برای یک رستوران/کافه هستی. وظایف تو:
- پاسخ به سوالات درباره منو، قیمت‌ها و ساعات کاری
- رزرو میز برای مشتریان
- اطلاع‌رسانی درباره رویدادها و پیشنهادات ویژه
- رسیدگی به سفارش‌های تحویل`,
    sampleFaqs: [
      { q: "ساعت کاری شما چیست؟", a: "ما هر روز از ساعت ۹ صبح تا ۱۲ شب فعال هستیم." },
      { q: "آیا میز رزرو می‌کنید؟", a: "بله، می‌توانید برای رزرو میز، تاریخ، ساعت و تعداد نفرات را inform کنید." },
      { q: "آیا منوی مخصوص گیاهخواران دارید؟", a: "بله، منوی گیاهی شامل سالاد، پاستا و پیتزا سبزیجات در منوی ما موجود است." },
    ],
  },
  {
    code: "doctor",
    label: "مطب پزشک",
    icon: "Stethoscope",
    category: "medical",
    prompt: `تو یک منشی هوشمند برای یک مطب پزشکی هستی. وظایف تو:
- نوبت‌دهی به بیماران
- پاسخ به سوالات درباره تخصص‌ها و ساعات ویزیت
- اطلاع‌رسانی درباره تعرفه‌ها و بیمه‌های طرف قرارداد
- یادآوری نوبت‌ها`,
    sampleFaqs: [
      { q: "چطور می‌توانم نوبت بگیرم؟", a: "می‌توانید از طریق همین گفتگو، تماس تلفنی یا وب‌سایت نوبت خود را رزرو کنید." },
      { q: "ساعت ویزیت شما چیست؟", a: "شنبه تا چهارشنبه ۱۶ تا ۲۰، پنجشنبه ۹ تا ۱۳." },
    ],
  },
  {
    code: "clinic",
    label: "کلینیک",
    icon: "Building2",
    category: "medical",
    prompt: `تو یک منشی هوشمند برای یک کلینیک تخصصی هستی. وظایف تو:
- نوبت‌دهی به بیماران
- معرفی تخصص‌ها و پزشکان
- پاسخ به سوالات درباره بیمه و تعرفه‌ها
- اطلاع‌رسانی درباره خدمات`,
    sampleFaqs: [
      { q: "چه تخصص‌هایی در کلینیک ارائه می‌شود؟", a: "ما دارای متخصصین قلب، داخلی، پوست، جراحی عمومی و زنان هستیم." },
      { q: "بیمه‌های طرف قرارداد کدامند؟", a: "تامین اجتماعی، سلامت و بیمه‌های تکمیلی ایران، آسیا و پاسارگاد." },
    ],
  },
  {
    code: "lawyer",
    label: "دفتر وکالت",
    icon: "Scale",
    category: "service",
    prompt: `تو یک منشی هوشمند برای یک دفتر وکالت هستی. وظایف تو:
- پاسخ به سوالات اولیه حقوقی
- تعیین وقت مشاوره
- معرفی تخصص‌های حقوقی
- اطلاع‌رسانی درباره تعرفه‌ها`,
    sampleFaqs: [
      { q: "برای چه موضوعاتی می‌توانم مشاوره بگیرم؟", a: "ما در زمینه‌های حقوقی دعاوی ملکی، خانواده، کیفری، تجاری و قراردادها مشاوره می‌دهیم." },
      { q: "هزینه مشاوره چقدر است؟", a: "هزینه مشاوره اولیه ۳۰ دقیقه‌ای ۲۰۰ هزار تومان است." },
    ],
  },
  {
    code: "travel",
    label: "آژانس مسافرتی",
    icon: "Plane",
    category: "travel",
    prompt: `تو یک منشی هوشمند برای یک آژانس مسافرتی هستی. وظایف تو:
- ارائه اطلاعات درباره تورها و قیمت‌ها
- کمک به رزرو بلیط و هتل
- اطلاع‌رسانی درباره ویزا و مدارک مورد نیاز
- پاسخ به سوالات درباره مقاصد گردشگری`,
    sampleFaqs: [
      { q: "چه تورهایی فعال دارید؟", a: "تورهای داخلی (کیش، مشهد، اصفهان) و خارجی (استانبول، دبی، آنتالیا) داریم." },
      { q: "آیا ویزا هم انجام می‌دهید؟", a: "بله، ویزای تورهای گروهی توسط آژانس انجام می‌شود." },
    ],
  },
  {
    code: "hotel",
    label: "هتل",
    icon: "BedDouble",
    category: "travel",
    prompt: `تو یک منشی هوشمند برای یک هتل هستی. وظایف تو:
- رزرو اتاق
- پاسخ به سوالات درباره امکانات و خدمات
- اطلاع‌رسانی درباره قیمت‌ها و تخفیف‌ها
- پیگیری درخواست‌های مهمانان`,
    sampleFaqs: [
      { q: "قیمت اتاق‌ها چقدر است؟", a: "اتاق استاندارد ۸۰۰ هزار، سوئیت ۱٫۵ میلیون و سوئیت رویال ۲٫۵ میلیون تومان برای هر شب." },
      { q: "آیا صبحانه شامل قیمت می‌شود؟", a: "صبحانه برای تمام اتاق‌ها به صورت رایگان سرو می‌شود." },
    ],
  },
  {
    code: "academy",
    label: "آموزشگاه",
    icon: "GraduationCap",
    category: "education",
    prompt: `تو یک منشی هوشمند برای یک آموزشگاه هستی. وظایف تو:
- معرفی دوره‌ها و شهریه‌ها
- ثبت‌نام هنرجویان
- اطلاع‌رسانی درباره زمان‌بندی کلاس‌ها
- پاسخ به سوالات درباره اساتید و مدارک`,
    sampleFaqs: [
      { q: "چه دوره‌هایی دارید؟", a: "دوره‌های زبان (انگلیسی، آلمانی، فرانسوی)، کامپیوتر و موسیقی." },
      { q: "شهریه دوره‌ها چقدر است؟", a: "هر ترم ۱۸ جلسه، شهریه از ۱ میلیون تا ۳ میلیون تومان متغیر است." },
    ],
  },
  {
    code: "realestate",
    label: "املاک",
    icon: "Home",
    category: "service",
    prompt: `تو یک منشی هوشمند برای یک بنگاه املاک هستی. وظایف تو:
- معرفی ملک‌های موجود برای فروش و رهن
- پاسخ به سوالات درباره قیمت‌ها و شرایط
- تنظیم وقت بازدید
- پیگیری معاملات`,
    sampleFaqs: [
      { q: "چه ملک‌هایی برای فروش دارید؟", a: "آپارتمان، ویلا و تجاری در مناطق مختلف تهران." },
      { q: "هزینه مشاوره چقدر است؟", a: "مشاوره و بازدید اولیه رایگان است." },
    ],
  },
  {
    code: "other",
    label: "سایر",
    icon: "Briefcase",
    category: "other",
    prompt: `تو یک منشی هوشمند برای یک کسب‌وکار هستی. وظایف تو:
- پاسخ به سوالات مشتریان درباره محصولات و خدمات
- ثبت اطلاعات تماس و پیگیری
- راهنمایی درباره ساعات کاری و موقعیت
- انتقال درخواست‌ها به تیم پشتیبانی`,
    sampleFaqs: [
      { q: "ساعت کاری شما چیست؟", a: "ما از شنبه تا پنجشنبه ۹ صبح تا ۶ بعدازظهر فعال هستیم." },
      { q: "چطور می‌توانم با شما تماس بگیرم؟", a: "می‌توانید از طریق همین گفتگو، تماس تلفنی یا ایمیل با ما در ارتباط باشید." },
    ],
  },
];

const PLANS = [
  {
    code: "starter",
    name: "استارتر",
    description: "مناسب کسب‌وکارهای نوپا و کوچک",
    priceMonthly: 290000,
    messageLimit: 1000,
    conversationLimit: 200,
    voiceMinutes: 0,
    tokenLimit: 200000,
    featuresJson: JSON.stringify(["۱ منشی هوشمند", "۱۰۰۰ پیام در ماه", "پشتیبانی وب‌سایت", "۱ کاربر", "گزارش پایه"]),
    popular: false,
  },
  {
    code: "growth",
    name: "گراث",
    description: "برای کسب‌وکارهای در حال رشد",
    priceMonthly: 890000,
    messageLimit: 5000,
    conversationLimit: 1000,
    voiceMinutes: 120,
    tokenLimit: 1200000,
    featuresJson: JSON.stringify(["۱ منشی هوشمند", "۵۰۰۰ پیام در ماه", "پشتیبانی وب و اینستاگرام", "۵ کاربر", "تحلیل گفتگو", "لید خودکار", "۱۲۰ دقیقه تماس صوتی"]),
    popular: true,
  },
  {
    code: "business",
    name: "بیزینس",
    description: "برای کسب‌وکارهای متوسط و بزرگ",
    priceMonthly: 1990000,
    messageLimit: 20000,
    conversationLimit: 5000,
    voiceMinutes: 600,
    tokenLimit: 6000000,
    featuresJson: JSON.stringify(["۳ منشی هوشمند", "۲۰۰۰۰ پیام در ماه", "همه کانال‌ها", "کاربر نامحدود", "تحلیل پیشرفته", "Voice Agent", "API دسترسی", "۶۰۰ دقیقه تماس"]),
    popular: false,
  },
  {
    code: "enterprise",
    name: "سازمانی",
    description: "راهکار اختصاصی برای سازمان‌ها",
    priceMonthly: 4990000,
    messageLimit: 100000,
    conversationLimit: 30000,
    voiceMinutes: 3000,
    tokenLimit: 30000000,
    featuresJson: JSON.stringify(["منشی نامحدود", "پیام نامحدود", "تماس صوتی نامحدود", "سرور اختصاصی", "SLA تضمینی", "پشتیبانی ۲۴/۷", "ادغام سفارشی", "امنیت سازمانی"]),
    popular: false,
  },
];

const DEMO_TENANTS = [
  {
    slug: "cafe-bamdad",
    name: "کافه بامداد",
    businessType: "restaurant",
    description: "کافه‌رستوران دنج با منوی متنوع کافه و غذاهای ایتالیایی",
    phone: "021-88123456",
    address: "تهران، الهیه، خیابان فرشته",
    instagram: "@cafe_bamdad",
    accentColor: "#f59e0b",
    category: "food",
    knowledge: [
      { type: "faq", title: "ساعات کاری", question: "ساعات کاری کافه بامداد چیست؟", content: "کافه بامداد هر روز از ساعت ۹ صبح تا ۱۲ نیمه‌شب پذیرای شما عزیزان است. در تعطیلات نیز همان ساعات فعال هستیم." },
      { type: "faq", title: "منو و قیمت", question: "منو و قیمت‌ها چطور است؟", content: "منو شامل قهوه‌های تخصصی (۳۵ تا ۸۵ هزار تومان)، صبحانه (۹۵ تا ۱۸۰ هزار تومان)، پاستا و پیتزا (۱۸۰ تا ۳۲۰ هزار تومان) و دسرهای خانگی است." },
      { type: "faq", title: "رزرو میز", question: "آیا می‌توان میز رزرو کرد؟", content: "بله، رزرو میز امکان‌پذیر است. لطفاً تعداد نفرات و تاریخ و ساعت مورد نظر را بفرمایید. رزرو برای جمع‌های بالای ۶ نفر توصیه می‌شود." },
    ],
  },
  {
    slug: "clinic-noor",
    name: "کلینیک تخصصی نور",
    businessType: "clinic",
    description: "کلینیک تخصصی با پزشکان جراح، داخلی، قلب و پوست",
    phone: "021-22009988",
    address: "تهران، سعادت‌آباد، بلوار دریا",
    instagram: "@clinic_noor",
    accentColor: "#0ea5e9",
    category: "medical",
    knowledge: [
      { type: "faq", title: "متخصصین", question: "چه متخصصینی دارید؟", content: "کلینیک نور دارای متخصصین قلب و عروق، داخلی، پوست و مو، جراح عمومی، ارتوپد و زنان است." },
      { type: "faq", title: "ساعات وصول", question: "ساعات وصول بیماران؟", content: "شنبه تا چهارشنبه از ساعت ۱۶ تا ۲۰ و پنجشنبه ۹ تا ۱۳." },
    ],
  },
  {
    slug: "shop-modern",
    name: "فروشگاه مدرن‌کالا",
    businessType: "store",
    description: "فروشگاه آنلاین لوازم خانگی و دیجیتال",
    phone: "021-91002030",
    address: "تهران، جمهوری، پاساژ علاءالدین",
    instagram: "@modernkala",
    accentColor: "#8b5cf6",
    category: "shop",
    knowledge: [
      { type: "faq", title: "ارسال و پیک", question: "هزینه و زمان ارسال چقدر است؟", content: "ارسال در تهران با پیک موتور ۲۴ ساعته (۴۵ هزار تومان)، در شهرستان‌ها با پست ۲ تا ۴ روز کاری." },
      { type: "faq", title: "گارانتی", question: "گارانتی محصولات چگونه است؟", content: "تمام محصولات با گارانتی اصالت و سلامت فیزیکی عرضه می‌شوند." },
    ],
  },
  {
    slug: "travel-parastoo",
    name: "آژانس مسافرتی پرستو",
    businessType: "travel",
    description: "آژانس گردشگری با تورهای داخلی و خارجی",
    phone: "021-88776655",
    address: "تهران، میرداماد، برج پارسیان",
    instagram: "@parastoo_travel",
    accentColor: "#ec4899",
    category: "travel",
    knowledge: [
      { type: "faq", title: "تورهای فعال", question: "تورهای فعلی کدامند؟", content: "تورهای فعال: کیش ۳ روزه از ۴٫۵ میلیون، استانبول ۵ روزه از ۱۲ میلیون، دبی ۴ روزه از ۹ میلیون." },
      { type: "faq", title: "ویزا", question: "برای ویزا چه مدارکی لازم است؟", content: "پاسپورت با حداقل ۶ ماه اعتبار، عکس پرسنلی، سفرنامه، گواهی شغل." },
    ],
  },
  {
    slug: "academy-zaban",
    name: "آموزشگاه زبان آرمان",
    businessType: "academy",
    description: "آموزشگاه زبان انگلیسی، آلمانی و فرانسوی",
    phone: "021-77665544",
    address: "تهران، شهرک غرب، بلوار فرحزادی",
    instagram: "@arman_academy",
    accentColor: "#14b8a6",
    category: "education",
    knowledge: [
      { type: "faq", title: "دوره‌ها", question: "چه دوره‌هایی دارید؟", content: "دوره‌های انگلیسی (عمومی، آیلتس، تافل)، آلمانی (A1 تا C1)، فرانسوی و اسپانیایی." },
      { type: "faq", title: "کلاس آنلاین", question: "کلاس آنلاین هم دارید؟", content: "بله، تمام دوره‌ها به صورت حضوری، آنلاین (Google Meet) و ترکیبی برگزار می‌شوند." },
    ],
  },
];

function buildChunks(content: string, question?: string): KnowledgeChunk[] {
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
  return sentences.slice(0, 3).map((s) => ({
    text: s.trim(),
    keywords: (question || s).split(/\s+/).filter((w) => w.length > 2),
  }));
}

function getBusinessType(code: string): BusinessTypeInfo {
  return BUSINESS_TYPES.find((bt) => bt.code === code) || BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
}

async function seedDatabase(force = false) {
  const existing = await db.plan.count();
  if (existing > 0 && !force) {
    console.log("✅ Database already seeded (found existing plans). Use --force to re-seed.");
    return { seeded: false };
  }

  if (force) {
    console.log("⚠️  Force mode: wiping all existing data...");
    await db.message.deleteMany();
    await db.booking.deleteMany();
    await db.lead.deleteMany();
    await db.tokenUsageLog.deleteMany();
    await db.internalLead.deleteMany();
    await db.invoice.deleteMany();
    await db.subscription.deleteMany();
    await db.referral.deleteMany();
    await db.conversation.deleteMany();
    await db.knowledgeItem.deleteMany();
    await db.agent.deleteMany();
    await db.user.deleteMany();
    await db.tenant.deleteMany();
    await db.plan.deleteMany();
    await db.platformConfig.deleteMany();
  }

  console.log("🌱 Seeding database...");

  // Plans
  const planMap: Record<string, string> = {};
  for (const p of PLANS) {
    const plan = await db.plan.create({ data: p });
    planMap[p.code] = plan.id;
    console.log(`  📋 Plan: ${p.name} (${p.code})`);
  }

  const adminHash = await bcrypt.hash("admin", 10);
  const demoHash = await bcrypt.hash("demo123", 10);

  // Super admin
  await db.user.create({
    data: {
      email: "admin@email.com",
      name: "مدیر سیستم",
      role: "super_admin",
      passwordHash: adminHash,
    },
  });
  console.log(`  👤 Super admin: admin@email.com / admin`);

  const now = new Date();
  let totalRevenue = 0;

  for (let i = 0; i < DEMO_TENANTS.length; i++) {
    const t = DEMO_TENANTS[i];
    const bt = getBusinessType(t.businessType);
    const planCode = ["starter", "growth", "business", "growth", "business"][i] || "growth";
    const planId = planMap[planCode];

    const tenant = await db.tenant.create({
      data: {
        slug: t.slug,
        name: t.name,
        businessType: t.businessType,
        description: t.description,
        phone: t.phone,
        address: t.address,
        instagram: t.instagram,
        accentColor: t.accentColor,
        category: t.category,
        planId,
        status: "active",
      },
    });

    // Users
    const ownerEmail = `owner${i + 1}@${t.slug}.com`;
    await db.user.create({ data: { email: ownerEmail, name: `مدیر ${t.name}`, role: "business_owner", tenantId: tenant.id, passwordHash: demoHash } });
    await db.user.create({ data: { email: `op${i + 1}@${t.slug}.com`, name: `اپراتور ${t.name}`, role: "operator", tenantId: tenant.id, passwordHash: demoHash } });

    // Agent
    await db.agent.create({
      data: {
        tenantId: tenant.id,
        name: `منشی ${t.name}`,
        systemPrompt: bt.prompt,
        greetingMessage: `سلام! من منشی هوشمند ${t.name} هستم. چطور می‌توانم کمکتان کنم؟`,
        channelsJson: JSON.stringify(["website", "widget", "instagram", "whatsapp"]),
        voiceEnabled: planCode === "business" || planCode === "enterprise",
      },
    });

    // Knowledge
    for (const k of t.knowledge) {
      const chunks = buildChunks(k.content, k.type === "faq" ? k.question : undefined);
      await db.knowledgeItem.create({
        data: { tenantId: tenant.id, type: k.type, title: k.title, question: k.question || "", content: k.content, chunksJson: JSON.stringify(chunks), status: "ready", size: k.content.length },
      });
    }

    // Subscription
    const plan = PLANS.find((p) => p.code === planCode)!;
    await db.subscription.create({
      data: {
        tenantId: tenant.id,
        planId,
        status: "active",
        renewsAt: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
      },
    });
    totalRevenue += plan.priceMonthly;

    // Invoices
    for (let m = 0; m < 3; m++) {
      await db.invoice.create({
        data: { tenantId: tenant.id, planId, amount: plan.priceMonthly, status: "paid", periodStart: new Date(now.getFullYear(), now.getMonth() - m, 1), periodEnd: new Date(now.getFullYear(), now.getMonth() - m + 1, 0) },
      });
    }

    // Referral
    await db.referral.create({
      data: { tenantId: tenant.id, code: t.slug.toUpperCase().replace(/-/g, "").slice(0, 8) },
    });

    console.log(`  🏪 ${t.name} (${ownerEmail} / demo123)`);
  }

  await db.platformConfig.upsert({
    where: { key: "platform_stats" },
    create: { key: "platform_stats", valueJson: JSON.stringify({ seededAt: now.toISOString(), totalRevenue }) },
    update: { valueJson: JSON.stringify({ seededAt: now.toISOString(), totalRevenue }) },
  });

  console.log(`\n✅ Seed complete!`);
  console.log(`   ${PLANS.length} plans, ${DEMO_TENANTS.length} tenants`);
  console.log(`   Admin: admin@email.com / admin`);
  console.log(`   Demo users: owner1@... / demo123`);

  return { seeded: true, plans: PLANS.length, tenants: DEMO_TENANTS.length, totalRevenue };
}

// Run as CLI
async function main() {
  const force = process.argv.includes("--force");
  try {
    await seedDatabase(force);
  } catch (e: any) {
    console.error("❌ Seed failed:", e.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();