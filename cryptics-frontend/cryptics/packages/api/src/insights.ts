export type TechnicalInsight = {
  name: string;
  value: number | string;
  interpretation?: string;
};

export type SentimentSummary = {
  score: number; // -1..1
  bullish: number;
  bearish: number;
  neutral: number;
  summary?: string;
};

export type Opportunity = {
  id: string;
  title: string;
  description?: string;
  confidence: number; // 0..1
};

export type InsightsResponse = {
  symbol: string;
  technical: TechnicalInsight[];
  sentiment: SentimentSummary;
  opportunities: Opportunity[];
  signal?: "BUY" | "HOLD" | "SELL";
  confidence?: number; // 0..1
  updated_at?: string;
};

export async function getInsights(symbol: string): Promise<InsightsResponse> {
  const base = (process.env.NEXT_PUBLIC_API_BASE as string) || "";
  const url = `${base}/insights/${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load insights: ${res.status}`);
  }
  const json = await res.json();
  return json as InsightsResponse;
}
