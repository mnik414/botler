import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/billing/usdt-rate — fetches the live USDT/Toman exchange rate
// Tries multiple Iranian crypto exchange APIs with fallback to a cached/stored rate.
// Caches the result in PlatformConfig for 5 minutes to avoid rate-limiting.

const CACHE_KEY = "usdt_toman_rate";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface RateCache {
  rate: number;
  source: string;
  fetchedAt: string;
}

async function fetchFromNobitex(): Promise<number | null> {
  try {
    // Nobitex API — public market stats for USDT/IRT
    const res = await fetch("https://api.nobitex.ir/market/stats?srcCurrency=usdt&dstCurrency=rls", {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Nobitex returns rls (Rial); convert to Toman by /10
    const latest = data?.stats?.["usdt-rls"]?.latest;
    if (latest && !isNaN(Number(latest))) {
      return Math.round(Number(latest) / 10); // Rial → Toman
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchFromWallex(): Promise<number | null> {
  try {
    // Wallex API — public market data for USDTTMN
    const res = await fetch("https://api.wallex.ir/v1/market?quote_currency=tmn", {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const usdtMarket = data?.result?.symbols?.["USDTTMN"];
    if (usdtMarket) {
      const price = Number(usdtMarket.latest || usdtMarket.ask || usdtMarket.bid);
      if (!isNaN(price) && price > 0) return Math.round(price);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchFromRamzinex(): Promise<number | null> {
  try {
    // Ramzinex API — public prices
    const res = await fetch("https://publicapi.ramzinex.com/exchange/api/v1.0/exchange/pairs/?base_symbol=usdt&quote_symbol=rls", {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.data?.price || data?.data?.last_price;
    if (price && !isNaN(Number(price))) {
      return Math.round(Number(price) / 10); // Rial → Toman
    }
    return null;
  } catch {
    return null;
  }
}

async function getCachedRate(): Promise<RateCache | null> {
  const config = await db.platformConfig.findUnique({ where: { key: CACHE_KEY } });
  if (!config) return null;
  try {
    const parsed = JSON.parse(config.valueJson) as RateCache;
    const age = Date.now() - new Date(parsed.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function setCachedRate(rate: number, source: string) {
  const cache: RateCache = { rate, source, fetchedAt: new Date().toISOString() };
  await db.platformConfig.upsert({
    where: { key: CACHE_KEY },
    create: { key: CACHE_KEY, valueJson: JSON.stringify(cache) },
    update: { valueJson: JSON.stringify(cache) },
  });
}

export async function GET() {
  try {
    // 1. Check cache first
    const cached = await getCachedRate();
    if (cached) {
      return NextResponse.json({
        rate: cached.rate,
        source: cached.source,
        cached: true,
        fetchedAt: cached.fetchedAt,
      });
    }

    // 2. Try live APIs in parallel (first successful wins)
    const [nobitex, wallex, ramzinex] = await Promise.allSettled([
      fetchFromNobitex(),
      fetchFromWallex(),
      fetchFromRamzinex(),
    ]);

    let rate: number | null = null;
    let source = "";

    if (nobitex.status === "fulfilled" && nobitex.value) {
      rate = nobitex.value;
      source = "Nobitex";
    } else if (wallex.status === "fulfilled" && wallex.value) {
      rate = wallex.value;
      source = "Wallex";
    } else if (ramzinex.status === "fulfilled" && ramzinex.value) {
      rate = ramzinex.value;
      source = "Ramzinex";
    }

    // 3. Fallback: if all APIs fail, use a stored fallback (last known or default)
    if (!rate) {
      const fallbackConfig = await db.platformConfig.findUnique({ where: { key: CACHE_KEY } });
      if (fallbackConfig) {
        try {
          const old = JSON.parse(fallbackConfig.valueJson) as RateCache;
          rate = old.rate;
          source = old.source + " (cached fallback)";
        } catch {}
      }
    }
    if (!rate) {
      rate = 160000; // last-resort hardcoded fallback
      source = "fallback (default)";
    }

    // 4. Cache the result
    await setCachedRate(rate, source);

    return NextResponse.json({
      rate,
      source,
      cached: false,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    // Ultimate fallback
    return NextResponse.json({
      rate: 160000,
      source: "fallback (error)",
      error: e.message,
      fetchedAt: new Date().toISOString(),
    });
  }
}
