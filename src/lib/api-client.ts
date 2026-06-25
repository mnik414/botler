// Client-side API helpers
import type { ChatMessage, RagSource } from "@/lib/types";

// Reads the persisted session (user id + role) so we can send it as headers
// for server-side role gating on protected mutations.
function getSessionHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("ai-receptionist");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const session = parsed?.state?.session;
    if (!session?.id) return {};
    return {
      "X-User-Id": session.id,
      "X-User-Role": session.role || "",
    };
  } catch {
    return {};
  }
}

export async function api<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...getSessionHeaders(),
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "خطای سرور");
  }
  return res.json();
}

export interface Session {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  tenant: { id: string; slug: string; name: string; businessType: string; accentColor: string } | null;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceQuarterly?: number;
  priceYearly?: number;
  priceUsdt?: number;
  trialDays?: number;
  messageLimit: number;
  conversationLimit: number;
  voiceMinutes: number;
  tokenLimit: number;
  features: string[];
  popular: boolean;
  active?: boolean;
}

export interface MarketplaceItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  businessType: string;
  businessTypeLabel: string;
  icon: string;
  category: string;
  accentColor: string;
  instagram: string;
  phone: string;
  address: string;
}

export interface KnowledgeItem {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  content: string;
  question: string;
  url: string;
  status: string;
  size: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  tenantId: string;
  endUserName: string;
  endUserPhone: string;
  channel: string;
  status: string;
  confidence: number;
  satisfaction: number;
  messageCount: number;
  leadCaptured: boolean;
  createdAt: string;
  updatedAt: string;
  messages?: (ChatMessage & { id: string })[];
}

export interface Lead {
  id: string;
  tenantId: string;
  conversationId: string | null;
  name: string;
  phone: string;
  email: string;
  source: string;
  intent: string;
  status: string;
  value: number;
  createdAt: string;
  conversation?: { id: string; channel: string } | null;
}

export interface AgentConfig {
  id: string;
  tenantId: string;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  confidenceThreshold: number;
  greetingMessage: string;
  channels: string[];
  voiceEnabled: boolean;
  humanHandoff: boolean;
  growthLoop: boolean;
}

export interface Analytics {
  tenant: any;
  subscription: any;
  kpis: {
    totalConversations: number;
    totalLeads: number;
    convertedLeads: number;
    conversionRate: number;
    handoffCount: number;
    avgConfidence: number;
    avgSatisfaction: number;
    totalTokens: number;
    revenue: number;
    internalLeads: number;
  };
  usage: any;
  trends: { date: string; conversations: number; leads: number }[];
  channels: { channel: string; count: number }[];
  leadsByStatus: { status: string; count: number }[];
  analysis: any;
}

export interface AdminStats {
  kpis: {
    totalTenants: number;
    activeTenants: number;
    totalUsers: number;
    totalConversations: number;
    totalLeads: number;
    totalInternalLeads: number;
    mrr: number;
    totalRevenue: number;
    totalTokens: number;
  };
  plans: { plan: string; code: string; count: number; revenue: number }[];
  topTenants: { id: string; name: string; slug: string; plan: string; status: string; createdAt: string; mrr: number; tokens: number }[];
  revenueTrend: { date: string; revenue: number; conversations: number }[];
  tokenUsageByTenant: { name: string; tokens: number }[];
}

export interface ChatResponse {
  conversationId: string;
  reply: string;
  confidence: number;
  sources: RagSource[];
  handoff: boolean;
  lead: { name?: string; phone?: string; email?: string; detected: boolean };
  growth: { isBusinessOwner: boolean; score: number; signals: string[] };
  leadCreated: { id: string; name: string } | null;
  bookingCreated: { id: string; type: string; label: string } | null;
  tokens: number;
}
