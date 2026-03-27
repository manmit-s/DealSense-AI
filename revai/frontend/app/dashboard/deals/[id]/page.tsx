"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Copy,
  Gauge,
  Loader2,
  Mail,
  RefreshCcw,
  ShieldAlert,
  Swords,
  User,
  Wallet,
} from "lucide-react";

interface RiskItem {
  type: string;
  description: string;
  severity: string;
}

interface DealActivityItem {
  timestamp: string;
  subject: string;
  from_name: string;
}

interface RecoveryPlay {
  diagnosis: string;
  recommended_action: string;
  email_draft: { subject: string; body: string };
  talking_points: string[];
}

interface DealDetail {
  id: string;
  title: string;
  value: number;
  stage: string;
  close_date?: string | null;
  health_score: number;
  risk_signals: Array<Record<string, unknown>>;
  last_contact_date?: string | null;
  assigned_to?: string | null;
  analysis: {
    risk_items: RiskItem[];
    recovery_play?: RecoveryPlay | null;
    analysis_run_at?: string | null;
    recent_activity: DealActivityItem[];
  };
}

interface RecoveryResponse {
  deal_id: string;
  health_score: number;
  risk_level: string;
  recovery_play?: RecoveryPlay | null;
}

const fetcher = async ([url, token]: [string, string]) => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch deal details");
  }

  return res.json();
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const getRiskColor = (severity: string) => {
  const s = (severity || "").toLowerCase();
  if (s === "critical") return "text-red border-red/40 bg-red/10";
  if (s === "high") return "text-amber border-amber/40 bg-amber/10";
  if (s === "low") return "text-green border-green/40 bg-green/10";
  return "text-cyan border-cyan/40 bg-cyan/10";
};

const getRiskIcon = (type: string) => {
  const value = (type || "").toLowerCase();
  if (value.includes("silence")) return <AlertTriangle className="w-4 h-4" />;
  if (value.includes("competitor")) return <Swords className="w-4 h-4" />;
  if (value.includes("budget")) return <Wallet className="w-4 h-4" />;
  if (value.includes("stakeholder")) return <User className="w-4 h-4" />;
  return <ShieldAlert className="w-4 h-4" />;
};

const HealthGauge = ({ score }: { score: number }) => {
  const safeScore = Math.max(0, Math.min(100, score || 0));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75; // 270 degrees arc
  const arcLength = circumference * arcFraction;
  const strokeOffset = arcLength - (safeScore / 100) * arcLength;

  const color = safeScore >= 65 ? "#00C853" : safeScore >= 40 ? "#FFB300" : "#FF1744";

  return (
    <div className="relative w-[120px] h-[120px]">
      <svg className="w-[120px] h-[120px]" viewBox="0 0 120 120">
        <g transform="translate(60,60) rotate(135) translate(-60,-60)">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#232630"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeOffset}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[28px] font-bold" style={{ color }}>
          {safeScore}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-text-muted">Deal Health</span>
      </div>
    </div>
  );
};

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const dealId = params?.id;

  const { data: session, status } = useSession();
  const token = session?.user?.accessToken || "";

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const canFetch = status === "authenticated" && Boolean(token) && Boolean(dealId);

  const {
    data: deal,
    error,
    isLoading,
    mutate,
  } = useSWR<DealDetail>(canFetch ? [`${API_URL}/api/deals/${dealId}`, token] : null, fetcher);

  const [isGenerating, setIsGenerating] = useState(false);
  const [typedBody, setTypedBody] = useState("");
  const [displayRecovery, setDisplayRecovery] = useState<RecoveryPlay | null>(null);

  useEffect(() => {
    setDisplayRecovery(deal?.analysis?.recovery_play || null);
  }, [deal]);

  useEffect(() => {
    if (!displayRecovery?.email_draft?.body) {
      setTypedBody("");
      return;
    }

    setTypedBody("");
    const full = displayRecovery.email_draft.body;
    let index = 0;

    const timer = window.setInterval(() => {
      index += 2;
      setTypedBody(full.slice(0, index));
      if (index >= full.length) {
        window.clearInterval(timer);
      }
    }, 12);

    return () => window.clearInterval(timer);
  }, [displayRecovery?.email_draft?.body]);

  const riskItems = deal?.analysis?.risk_items || [];

  const lastRunLabel = useMemo(() => {
    const value = deal?.analysis?.analysis_run_at;
    if (!value) return "not run yet";
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return "not run yet";
    const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (mins === 0) return "just now";
    if (mins === 1) return "1 minute ago";
    return `${mins} minutes ago`;
  }, [deal?.analysis?.analysis_run_at]);

  const runRecovery = async () => {
    if (!dealId || !token) return;
    setIsGenerating(true);

    try {
      const res = await fetch(`${API_URL}/api/deals/${dealId}/recovery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to generate recovery play");

      const payload: RecoveryResponse = await res.json();
      setDisplayRecovery(payload.recovery_play || null);
      await mutate();
    } catch {
      // Keep UI stable if generation fails.
    } finally {
      setIsGenerating(false);
    }
  };

  const copyEmail = async () => {
    const draft = displayRecovery?.email_draft;
    if (!draft) return;
    const content = `Subject: ${draft.subject}\n\n${draft.body}`;
    await navigator.clipboard.writeText(content);
  };

  if (status === "loading" || (canFetch && isLoading)) {
    return <div className="animate-pulse rounded-xl bg-elevated h-[560px]" />;
  }

  if (status === "unauthenticated") {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-text-secondary">
        Sign in to view this deal analysis.
      </div>
    );
  }

  if (status === "authenticated" && !token) {
    return (
      <div className="bg-surface border border-red/40 rounded-xl p-6 text-red">
        Session token missing. Sign out and sign in again.
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="bg-surface border border-red/40 rounded-xl p-6 text-text-secondary">
        Unable to load deal details.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 text-text-primary">
      <div className="space-y-6">
        <section className="bg-surface border border-border rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-mono font-bold leading-tight">{deal.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-cyan font-mono">
                  {formatCurrency(deal.value)}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-elevated border border-border">{deal.stage}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Close {formatDate(deal.close_date)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  {deal.assigned_to || "Unassigned"}
                </span>
              </div>
            </div>
            <HealthGauge score={deal.health_score} />
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Risk Signals</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-elevated border border-border text-text-muted">
              {riskItems.length}
            </span>
          </div>

          {riskItems.length > 0 ? (
            <div className="space-y-2">
              {riskItems.map((risk, index) => (
                <div
                  key={`${risk.type}-${index}`}
                  className={`flex items-start gap-3 border rounded-lg px-3 py-2 ${getRiskColor(risk.severity)}`}
                >
                  <span className="mt-0.5">{getRiskIcon(risk.type)}</span>
                  <div>
                    <p className="text-sm font-medium capitalize">{risk.type}</p>
                    <p className="text-sm text-text-secondary">{risk.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-text-muted text-sm">No active risk signals detected.</div>
          )}
        </section>

        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          {deal.analysis.recent_activity.length > 0 ? (
            <div className="space-y-3">
              {deal.analysis.recent_activity.map((item, idx) => (
                <div key={`${item.timestamp}-${idx}`} className="border-l border-border pl-4">
                  <p className="text-xs text-text-muted mb-1">{formatDate(item.timestamp)}</p>
                  <p className="text-sm text-text-primary">{item.subject}</p>
                  <p className="text-xs text-text-secondary">from {item.from_name}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-text-muted text-sm">No timeline entries yet.</div>
          )}
        </section>
      </div>

      <aside className="bg-surface border border-border rounded-xl p-5 min-h-[560px] flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold">AI Analysis</h2>
            <p className="text-xs text-text-muted mt-1">Last run: {lastRunLabel}</p>
          </div>
          <button
            onClick={runRecovery}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border bg-elevated hover:bg-bg-elevated/80 disabled:opacity-60"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            Re-run
          </button>
        </div>

        {displayRecovery ? (
          <div className="space-y-4 flex-1">
            <div className="border-l-2 border-purple pl-3">
              <p className="text-xs uppercase tracking-wider text-text-muted mb-1">Diagnosis</p>
              <p className="text-sm text-text-secondary italic">{displayRecovery.diagnosis}</p>
            </div>

            <div className="rounded-lg border border-border bg-elevated p-3">
              <p className="text-xs uppercase tracking-wider text-text-muted mb-1">Recommended Action</p>
              <p className="text-sm font-medium">{displayRecovery.recommended_action}</p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs uppercase tracking-wider text-text-muted">Email Draft</p>
                <button onClick={copyEmail} className="inline-flex items-center gap-1 text-xs text-cyan hover:opacity-80">
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
              </div>
              <p className="text-sm font-semibold mb-2">{displayRecovery.email_draft.subject}</p>
              <pre className="whitespace-pre-wrap text-[12px] leading-5 text-text-secondary font-mono bg-bg-base rounded-md p-3 border border-border min-h-[150px]">
                {typedBody || displayRecovery.email_draft.body}
              </pre>
              <button className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-cyan text-bg-base text-sm font-semibold hover:opacity-90">
                <Mail className="w-4 h-4" />
                Edit and Send
              </button>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted mb-2">Talking Points</p>
              <ol className="space-y-2 text-sm">
                {(displayRecovery.talking_points || []).map((point, idx) => (
                  <li key={`${point}-${idx}`} className="rounded-lg border border-border bg-elevated px-3 py-2">
                    <span className="text-cyan mr-2 font-mono">{idx + 1}.</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <div className="flex-1 rounded-lg border border-green/30 bg-green/10 p-4 text-green">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <p className="font-semibold">Deal is on track</p>
            </div>
            <p className="text-sm text-text-secondary">
              No recovery play is required right now. You can still generate one to pressure test next steps.
            </p>
          </div>
        )}

        <button
          onClick={runRecovery}
          disabled={isGenerating}
          className="mt-5 w-full px-4 py-2.5 rounded-md bg-purple text-white font-semibold hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />}
          Generate Recovery Play
        </button>
      </aside>
    </div>
  );
}
