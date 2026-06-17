import { db } from "@/lib/db";
import { BUSINESS_TYPES, getBusinessType } from "@/lib/business-types";
import { buildChunks } from "@/lib/ai-engine";

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
      { type: "faq", title: "پارکینگ", question: "پارکینگ دارید؟", content: "بله، پارکینگ اختصاصی با ظرفیت ۱۲ ماشین در کنار کافه موجود است." },
      { type: "text", title: "اطلاعات کامل کافه", content: "کافه بامداد با بیش از ۵ سال سابقه، فضایی دنج برای دورهمی‌ها و جلسات کاری است. امکانات: وای‌فای رایگان، فضای باز، موسیقی زنده پنجشنبه‌ها، بخش کودک. پذیرفتن سفارش تحویل در محل از طریق سایت." },
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
      { type: "faq", title: "متخصصین", question: "چه متخصصینی دارید؟", content: "کلینیک نور دارای متخصصین قلب و عروق، داخلی، پوست و مو، جراح عمومی، ارتوپد و زنان است. برای لیست کامل به سایت مراجعه کنید." },
      { type: "faq", title: "ساعات وصول", question: "ساعات وصول بیماران؟", content: "شنبه تا چهارشنبه از ساعت ۱۶ تا ۲۰ و پنجشنبه ۹ تا ۱۳. نوبت‌دهی فقط با هماهنگی قبلی انجام می‌شود." },
      { type: "faq", title: "بیمه‌های طرف قرارداد", question: "بیمه‌های طرف قرارداد کدامند؟", content: "بیمه‌های پایه: تامین اجتماعی، سلامت، نیروهای مسلح. بیمه‌های تکمیلی: ایران، آسیا، پاسارگاد، ملت، رازی. بیمار باید قبل از ویزت کارت بیمه را به پذیرش تحویل دهد." },
      { type: "faq", title: "تعرفه ویزیت", question: "هزینه ویزیت چقدر است؟", content: "ویزیت متخصص از ۱۵۰ هزار تومان و ویزیت فوق تخصص از ۳۰۰ هزار تومان شروع می‌شود. در صورت استفاده از بیمه تکمیلی، بخشی از مبلغ بازگشت داده می‌شود." },
      { type: "text", title: "معرفی کلینیک", content: "کلینیک نور با ۱۲ سال سابقه و تیمی از بهترین متخصصین، خدمات تشخیصی و درمانی ارائه می‌دهد. مجهز به دستگاه‌های روز آزمایشگاه و تصویربرداری. خدمات آنلاین نوبت‌دهی از طریق این گفتگو در دسترس است." },
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
      { type: "faq", title: "ارسال و پیک", question: "هزینه و زمان ارسال چقدر است؟", content: "ارسال در تهران با پیک موتور ۲۴ ساعته (۴۵ هزار تومان)، در شهرستان‌ها با پست ۲ تا ۴ روز کاری (هزینه بر اساس وزن). سفارش‌های بالای ۲ میلیون تومان در تهران ارسال رایگان دارد." },
      { type: "faq", title: "گارانتی", question: "گارانتی محصولات چگونه است؟", content: "تمام محصولات شرکت‌های معتبر با گارانتی اصالت و سلامت فیزیکی عرضه می‌شوند. لوازم خانگی ۱۸ ماه گارانتی شرکتی دارند. برای استفاده از گارانتی فاکتور خرید الزامی است." },
      { type: "faq", title: "شرایط مرجوعی", question: "آیا امکان مرجوعی وجود دارد؟", content: "بله، تا ۷ روز پس از دریافت کالا قابل مرجوعی است به شرطی که در بسته‌بندی اصلی و سالم باشد. کالاهای باز شده و بهداشتی قابل مرجوعی نیستند." },
      { type: "faq", title: "نحوه پرداخت", question: "روش‌های پرداخت کدامند؟", content: "پرداخت آنلاین با تمام کارت‌های شتاب، پرداخت در محل (تهران)، اقساطی با کارت‌های عضو شبکه (تا ۱۲ ماه) و کیف پول مدرن‌کالا." },
      { type: "text", title: "درباره فروشگاه", content: "مدرن‌کالا با ۸ سال تجربه، ارائه‌دهنده لوازم خانگی برندهای بوش، ال‌جی، سامسونگ و پاکشوما و لوازم دیجیتال اپل، شیائومی و سونی. امکان خرید حضوری در پاساژ علاءالدین و آنلاین از سایت." },
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
      { type: "faq", title: "تورهای فعال", question: "تورهای فعلی کدامند؟", content: "تورهای فعال: کیش ۳ روزه از ۴٫۵ میلیون، استانبول ۵ روزه از ۱۲ میلیون، دبی ۴ روزه از ۹ میلیون، آنتالیا ۷ روزه از ۱۵ میلیون. تورهای گروپی با تخفیف ویژه." },
      { type: "faq", title: "ویزا", question: "برای ویزا چه مدارکی لازم است؟", content: "برای ویزا: پاسپورت با حداقل ۶ ماه اعتبار، عکس پرسنلی، سفرنامه، گواهی شغل و گردش حساب سه ماه اخیر. ویزای تورهای گروهی توسط آژانس انجام می‌شود." },
      { type: "faq", title: "بیمه مسافرتی", question: "بیمه مسافرتی شامل چه چیزی می‌شود؟", content: "بیمه مسافرتی شامل هزینه‌های پزشکی تا سقف ۳۰ هزار یورو، کنسلی سفر، مفقودی بار و تأخیر پرواز است. برای تمام تورهای خارجی اجباری است." },
      { type: "text", title: "درباره آژانس", content: "آژانس پرستو با ۱۵ سال سابقه و مجوز رسمی از سازمان گردشگری، تورهای داخلی و خارجی را با بهترین قیمت و بالاترین کیفیت ارائه می‌دهد. کارشناسان ما در طراحی سفر اختصاصی نیز همراه شما هستند." },
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
      { type: "faq", title: "دوره‌ها", question: "چه دوره‌هایی دارید؟", content: "دوره‌های انگلیسی (عمومی، آیلتس، تافل)، آلمانی (A1 تا C1)، فرانسوی و اسپانیایی. کلاس‌های کودکان (۷ تا ۱۲ سال) و نوجوانان جداگانه برگزار می‌شود." },
      { type: "faq", title: "شهریه", question: "شهریه دوره‌ها چقدر است؟", content: "هر ترم ۱۸ جلسه، شهریه انگلیسی ۱٫۲ میلیون، آلمانی ۱٫۵ میلیون و خصوصی ۳ میلیون تومان. تخفیف ۲۰٪ برای ثبت‌نام همراه." },
      { type: "faq", title: "کلاس آنلاین", question: "کلاس آنلاین هم دارید؟", content: "بله، تمام دوره‌ها به صورت حضوری، آنلاین (Google Meet) و ترکیبی برگزار می‌شوند. کلاس‌های آنلاین همان اساتید حضوری را دارند و امکان پخش مجدد ویدیو وجود دارد." },
      { type: "text", title: "درباره آموزشگاه", content: "آموزشگاه آرمان با ۱۰ سال سابقه و اساتید مجرب، آماده ارائه خدمات آموزشی به کودکان، نوجوانان و بزرگسالان است. دارای مجوز رسمی از سازمان آموزش فنی و حرفه‌ای. آزمون تعیین سطح رایگان." },
    ],
  },
];

function slugify(s: string) {
  return s.replace(/\s+/g, "-").toLowerCase();
}

export async function seedDatabase(force = false) {
  const existing = await db.plan.count();
  if (existing > 0 && !force) {
    return { seeded: false, message: "already seeded" };
  }

  if (force) {
    // Wipe in dependency order
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
  }

  // Plans
  const planMap: Record<string, string> = {};
  for (const p of PLANS) {
    const plan = await db.plan.create({ data: p });
    planMap[p.code] = plan.id;
  }

  // Super admin
  await db.user.create({
    data: {
      email: "admin@receptionist.ai",
      name: "مدیر سیستم",
      role: "super_admin",
      passwordHash: "admin123",
    },
  });

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

    // Business owner user
    const ownerEmail = `owner${i + 1}@${t.slug}.com`;
    await db.user.create({
      data: {
        email: ownerEmail,
        name: `مدیر ${t.name}`,
        role: "business_owner",
        tenantId: tenant.id,
        passwordHash: "demo123",
      },
    });

    // Operator user
    await db.user.create({
      data: {
        email: `op${i + 1}@${t.slug}.com`,
        name: `اپراتور ${t.name}`,
        role: "operator",
        tenantId: tenant.id,
        passwordHash: "demo123",
      },
    });

    // Agent with auto-built prompt
    await db.agent.create({
      data: {
        tenantId: tenant.id,
        name: `منشی ${t.name}`,
        systemPrompt: bt.prompt,
        model: "glm-4.6",
        temperature: 0.4,
        confidenceThreshold: 0.55,
        greetingMessage: `سلام! من منشی هوشمند ${t.name} هستم. چطور می‌توانم کمکتان کنم؟`,
        channelsJson: JSON.stringify(["website", "widget", "instagram", "whatsapp"]),
        voiceEnabled: planCode === "business" || planCode === "enterprise",
        humanHandoff: true,
        growthLoop: true,
      },
    });

    // Knowledge items with chunks
    for (const k of t.knowledge) {
      const chunks = buildChunks(k.content, k.type === "faq" ? k.question : undefined);
      await db.knowledgeItem.create({
        data: {
          tenantId: tenant.id,
          type: k.type,
          title: k.title,
          content: k.content,
          question: k.question || "",
          chunksJson: JSON.stringify(chunks),
          status: "ready",
          size: k.content.length,
        },
      });
    }

    // Subscription + invoice
    const plan = PLANS.find((p) => p.code === planCode)!;
    await db.subscription.create({
      data: {
        tenantId: tenant.id,
        planId,
        status: "active",
        renewsAt: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
        messageUsage: Math.floor(plan.messageLimit * (0.2 + Math.random() * 0.6)),
        conversationUsage: Math.floor(plan.conversationLimit * (0.15 + Math.random() * 0.5)),
        voiceUsage: Math.floor(plan.voiceMinutes * (0.1 + Math.random() * 0.5)),
        tokenUsage: Math.floor(plan.tokenLimit * (0.2 + Math.random() * 0.5)),
      },
    });
    totalRevenue += plan.priceMonthly;
    for (let m = 0; m < 3; m++) {
      await db.invoice.create({
        data: {
          tenantId: tenant.id,
          planId,
          amount: plan.priceMonthly,
          status: "paid",
          periodStart: new Date(now.getFullYear(), now.getMonth() - m, 1),
          periodEnd: new Date(now.getFullYear(), now.getMonth() - m + 1, 0),
        },
      });
    }

    // Referral
    await db.referral.create({
      data: {
        tenantId: tenant.id,
        code: t.slug.toUpperCase().replace(/-/g, "").slice(0, 8),
        clicks: Math.floor(Math.random() * 80) + 10,
        signups: Math.floor(Math.random() * 6),
        credits: Math.floor(Math.random() * 200000),
        commission: Math.floor(Math.random() * 500000),
      },
    });

    // Demo conversations + messages + leads
    const convoCount = 4 + Math.floor(Math.random() * 4);
    for (let c = 0; c < convoCount; c++) {
      const daysAgo = Math.floor(Math.random() * 14);
      const created = new Date(now.getTime() - daysAgo * 86400000);
      const isHandoff = Math.random() < 0.2;
      const hasLead = Math.random() < 0.55;
      const statuses = isHandoff ? "handoff" : "closed";
      const convo = await db.conversation.create({
        data: {
          tenantId: tenant.id,
          endUserName: hasLead ? ["علی محمدی", "سارا کریمی", "رضا حسینی", "مریم احمدی"][c % 4] : "مهمان",
          endUserPhone: hasLead ? `0912${String(1000000 + c * 11111).slice(0, 7)}` : "",
          channel: ["widget", "website", "instagram", "whatsapp"][c % 4],
          status: statuses,
          confidence: Number((0.4 + Math.random() * 0.5).toFixed(2)),
          satisfaction: Math.floor(Math.random() * 5) + 1,
          leadCaptured: hasLead,
          createdAt: created,
        },
      });

      const sampleQs = t.knowledge.map((k) => k.question || k.title);
      const q = sampleQs[c % sampleQs.length];
      const a = t.knowledge[c % t.knowledge.length].content.slice(0, 120);

      await db.message.create({
        data: { conversationId: convo.id, role: "user", content: q, createdAt: created },
      });
      await db.message.create({
        data: {
          conversationId: convo.id,
          role: "assistant",
          content: a,
          confidence: Number((0.6 + Math.random() * 0.35).toFixed(2)),
          tokens: 40 + Math.floor(Math.random() * 60),
          createdAt: new Date(created.getTime() + 30000),
        },
      });
      if (hasLead) {
        await db.message.create({
          data: {
            conversationId: convo.id,
            role: "user",
            content: "ممنون، شماره من 0912" + String(1000000 + c * 11111).slice(0, 7) + " است.",
            createdAt: new Date(created.getTime() + 60000),
          },
        });
        await db.lead.create({
          data: {
            tenantId: tenant.id,
            conversationId: convo.id,
            name: ["علی محمدی", "سارا کریمی", "رضا حسینی", "مریم احمدی"][c % 4],
            phone: "0912" + String(1000000 + c * 11111).slice(0, 7),
            email: "",
            source: "chat",
            intent: ["inquiry", "order", "booking", "appointment", "callback"][c % 5],
            status: ["new", "contacted", "converted", "new"][c % 4],
            value: 50000 + Math.floor(Math.random() * 10) * 50000,
          },
        });
      }

      // Some token usage logs
      await db.tokenUsageLog.create({
        data: { tenantId: tenant.id, tokens: 200 + Math.floor(Math.random() * 800), feature: "chat" },
      });
    }

    // An internal (growth-loop) lead
    await db.internalLead.create({
      data: {
        tenantId: tenant.id,
        endUserName: "کاربر نهایی",
        signal: "business_owner_signal",
        score: 75,
        status: "new",
      },
    });
  }

  await db.platformConfig.upsert({
    where: { key: "platform_stats" },
    create: { key: "platform_stats", valueJson: JSON.stringify({ seededAt: now.toISOString(), totalRevenue }) },
    update: { valueJson: JSON.stringify({ seededAt: now.toISOString(), totalRevenue }) },
  });

  return { seeded: true, plans: PLANS.length, tenants: DEMO_TENANTS.length, totalRevenue };
}
