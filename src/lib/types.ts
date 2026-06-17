// Shared types for the AI Receptionist Platform

export type BusinessType =
  | "store"
  | "restaurant"
  | "doctor"
  | "clinic"
  | "lawyer"
  | "travel"
  | "hotel"
  | "academy"
  | "realestate"
  | "other";

export type Role = "super_admin" | "business_owner" | "operator" | "end_user";

export type PlanCode = "starter" | "growth" | "business" | "enterprise";

export interface BusinessTypeInfo {
  code: BusinessType;
  label: string;
  icon: string; // lucide icon name
  prompt: string;
  category: string;
  sampleFaqs: { q: string; a: string }[];
}

export interface KnowledgeChunk {
  text: string;
  keywords: string[];
}

export interface RagSource {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export interface RagResult {
  sources: RagSource[];
  context: string;
  topScore: number;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "operator" | "system";
  content: string;
  confidence?: number;
  tokens?: number;
  sources?: RagSource[];
  handoff?: boolean;
  createdAt?: string;
}

export interface LeadCapture {
  name?: string;
  phone?: string;
  email?: string;
  detected: boolean;
}

export interface GrowthSignal {
  isBusinessOwner: boolean;
  score: number;
  signals: string[];
}

export interface ChatResult {
  reply: string;
  confidence: number;
  sources: RagSource[];
  handoff: boolean;
  lead: LeadCapture;
  growth: GrowthSignal;
  bookingIntent?: string;
  tokens: number;
}
