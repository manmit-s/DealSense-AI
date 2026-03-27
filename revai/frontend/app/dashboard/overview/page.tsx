"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  FunnelChart, Funnel, Tooltip, ResponsiveContainer, LabelList, Cell
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  RotateCw,
  Search,
  Brain,
  TrendingDown,
  Swords,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

interface DealAlertSummary {
  id: string;
  deal_id: string;
  deal_title: string;
  alert_type: string;
  severity: string;
  description: string;
  created_at: string;
}

interface AgentActivityItem {
  id: string;
  agent_type: string;
  action: string;
  status: string;
  created_at: string;
}

interface OverviewData {
  pipeline_value: number;
  deals_at_risk: number;
  prospects_in_queue: number;
  accounts_at_risk: number;
  pipeline_health_avg: number;
  recent_alerts: DealAlertSummary[];
  agent_activity: AgentActivityItem[];
}

interface FunnelData {
  stage: string;
  count: number;
  value: number;
  avg_health: number;
}

const fetcher = async ([url, token]: [string, string]) => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const error = new Error("An error occurred while fetching the data.");
    throw error;
  }
  return res.json();
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

export default function OverviewPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const token = session?.user?.accessToken || "";
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const bypassMode =
    searchParams.get("bypass") === "1" ||
    (typeof document !== "undefined" && document.cookie.includes("revai_bypass=1"));
  const canFetch = !bypassMode && status === "authenticated" && Boolean(token);

  const {
    data: overview,
    error: overviewError,
    isLoading: loadingOverview,
    isValidating: isRefreshingOverview,
    mutate: mutateOverview,
  } = useSWR<OverviewData>(
    canFetch ? [`${API_URL}/api/dashboard/overview`, token] : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const {
    data: funnel,
    isLoading: loadingFunnel,
    mutate: mutateFunnel,
  } = useSWR<FunnelData[]>(
    canFetch ? [`${API_URL}/api/dashboard/pipeline-funnel`, token] : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const bypassOverview: OverviewData = {
    pipeline_value: 450000,
    deals_at_risk: 3,
    prospects_in_queue: 7,
    accounts_at_risk: 2,
    pipeline_health_avg: 68,
    recent_alerts: [
      {
        id: "demo-alert-1",
        deal_id: "demo-deal-1",
        deal_title: "Acme Corp Expansion",
        alert_type: "silence",
        severity: "high",
        description: "No buyer response for 9 days before close date.",
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-alert-2",
        deal_id: "demo-deal-2",
        deal_title: "FinTrack Renewal",
        alert_type: "competitor",
        severity: "critical",
        description: "Competitor mentioned in latest email thread.",
        created_at: new Date().toISOString(),
      },
    ],
    agent_activity: [
      {
        id: "demo-log-1",
        agent_type: "deal_intel",
        action: "Generated recovery play for Acme Corp Expansion",
        status: "completed",
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-log-2",
        agent_type: "prospecting",
        action: "Scored 12 new prospects against ICP",
        status: "completed",
        created_at: new Date().toISOString(),
      },
    ],
  };

  const bypassFunnel: FunnelData[] = [
    { stage: "Prospect", count: 12, value: 120000, avg_health: 74 },
    { stage: "Qualified", count: 8, value: 180000, avg_health: 71 },
    { stage: "Demo", count: 5, value: 90000, avg_health: 66 },
    { stage: "Proposal", count: 4, value: 70000, avg_health: 62 },
    { stage: "Negotiation", count: 2, value: 40000, avg_health: 58 },
    { stage: "Closed Won", count: 3, value: 60000, avg_health: 85 },
    { stage: "Closed Lost", count: 1, value: 15000, avg_health: 35 },
  ];

  const displayOverview = overview ?? (bypassMode ? bypassOverview : null);
  const displayFunnel = funnel ?? (bypassMode ? bypassFunnel : null);

  const handleRefresh = async () => {
    await Promise.all([mutateOverview(), mutateFunnel()]);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case "prospecting":
        return <Search className="w-4 h-4 text-cyan" />;
      case "deal_intel":
        return <Brain className="w-4 h-4 text-purple" />;
      case "retention":
        return <TrendingDown className="w-4 h-4 text-amber" />;
      case "competitive":
        return <Swords className="w-4 h-4 text-red" />;
      default:
        return <Activity className="w-4 h-4 text-text-muted" />;
    }
  };

  const getSeverityAccent = (severity: string) => {
    const value = severity.toLowerCase();
    if (value === "critical") return "border-red";
    if (value === "high") return "border-amber";
    return "border-cyan";
  };

  const lastSyncedLabel = useMemo(() => {
    if (!overview) return "not synced";
    const latestSource = [
      ...overview.agent_activity.map((a) => new Date(a.created_at).getTime()),
      ...overview.recent_alerts.map((a) => new Date(a.created_at).getTime()),
    ];
    if (latestSource.length === 0) return "just now";
    const diffMs = Date.now() - Math.max(...latestSource);
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    if (mins === 0) return "just now";
    if (mins === 1) return "1 minute ago";
    return `${mins} minutes ago`;
  }, [overview]);

  if (!bypassMode && (status === "loading" || (canFetch && loadingOverview))) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-xl bg-elevated h-16" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="animate-pulse rounded-xl bg-elevated h-28" />
          <div className="animate-pulse rounded-xl bg-elevated h-28" />
          <div className="animate-pulse rounded-xl bg-elevated h-28" />
          <div className="animate-pulse rounded-xl bg-elevated h-28" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="animate-pulse rounded-xl bg-elevated h-72 xl:col-span-3" />
          <div className="animate-pulse rounded-xl bg-elevated h-72 xl:col-span-2" />
        </div>
        <div className="animate-pulse rounded-xl bg-elevated h-80" />
      </div>
    );
  }

  if (!bypassMode && status === "unauthenticated") {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 max-w-lg">
        <h2 className="text-lg font-bold mb-2">Session required</h2>
        <p className="text-text-secondary text-sm mb-4">Please sign in to load pipeline metrics and agent activity.</p>
        <Link href="/auth/login" className="inline-flex items-center bg-cyan text-black px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90">
          Go to login
        </Link>
      </div>
    );
  }

  if (!bypassMode && status === "authenticated" && !token) {
    return (
      <div className="bg-surface border border-red/40 rounded-xl p-6 max-w-lg">
        <h2 className="text-lg font-bold mb-2 text-red">Authentication token missing</h2>
        <p className="text-text-secondary text-sm">Your session does not include an API token. Sign out and sign in again.</p>
      </div>
    );
  }

  if (!bypassMode && (overviewError || !displayOverview)) {
    return (
      <div className="bg-surface border border-red/40 rounded-xl p-6 max-w-xl">
        <h2 className="text-lg font-bold mb-2 text-red">Unable to load dashboard overview</h2>
        <p className="text-text-secondary text-sm mb-4">The API request failed. Check backend availability and credentials, then retry.</p>
        <button
          onClick={handleRefresh}
          className="bg-elevated text-white px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 transition-opacity border border-border"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!displayOverview) {
    return null;
  }

  const COLORS = ["#00E5FF", "#05C6FF", "#18A9FF", "#338CFF", "#5B6DFF", "#7E51FF", "#9E3FFF"];

  return (
    <div className="space-y-6 text-text-primary">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-mono font-bold">Dashboard Overview</h1>
          <p className="text-text-muted text-sm mt-1">Pipeline health summary, active alerts, and live agent activity.</p>
          {bypassMode && (
            <p className="text-amber text-xs mt-1 uppercase tracking-wider">Bypass mode: showing demo data</p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <RotateCw className={`w-4 h-4 ${isRefreshingOverview ? "animate-spin" : ""}`} />
          <span>Last synced: {lastSyncedLabel}</span>
        </button>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <motion.div variants={itemVariants} className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-secondary text-xs uppercase tracking-wider">Pipeline Value</span>
            <Briefcase className="w-4 h-4 text-cyan" />
          </div>
          <div className={`text-3xl font-mono font-bold ${displayOverview.pipeline_value > 100000 ? "text-green" : "text-text-primary"}`}>
            {formatCurrency(displayOverview.pipeline_value)}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-secondary text-xs uppercase tracking-wider">Deals At Risk</span>
            <div className="relative h-3 w-3">
              {displayOverview.deals_at_risk > 0 ? (
                <>
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red opacity-70" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red" />
                </>
              ) : (
                <span className="inline-flex rounded-full h-3 w-3 bg-text-muted/60" />
              )}
            </div>
          </div>
          <div className={`text-3xl font-mono font-bold ${displayOverview.deals_at_risk > 0 ? "text-red" : "text-text-primary"}`}>
            {displayOverview.deals_at_risk}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-secondary text-xs uppercase tracking-wider">Prospects In Queue</span>
            <Users className="w-4 h-4 text-cyan" />
          </div>
          <div className="text-3xl font-mono font-bold text-cyan">
            {displayOverview.prospects_in_queue}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-secondary text-xs uppercase tracking-wider">Accounts At Risk</span>
            <AlertTriangle className="w-4 h-4 text-amber" />
          </div>
          <div className={`text-3xl font-mono font-bold ${displayOverview.accounts_at_risk > 0 ? "text-amber" : "text-text-primary"}`}>
            {displayOverview.accounts_at_risk}
          </div>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold">Active Alerts</h2>
            {displayOverview.recent_alerts.length > 0 && (
              <span className="bg-red/15 text-red text-xs px-2 py-0.5 rounded-full font-semibold">
                {displayOverview.recent_alerts.length}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {displayOverview.recent_alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border rounded-xl">
                <CheckCircle2 className="w-10 h-10 text-green mb-3" />
                <p className="text-white font-medium">No active alerts</p>
                <p className="text-text-muted text-sm mt-1">Pipeline is currently healthy.</p>
              </div>
            ) : (
              displayOverview.recent_alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 bg-elevated/60 rounded-lg border-l-4 ${getSeverityAccent(alert.severity)} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white mb-1 truncate">{alert.deal_title}</h3>
                    <p className="text-text-secondary text-sm truncate">{alert.description}</p>
                    <p className="text-text-muted text-xs mt-1 uppercase tracking-wide">
                      {alert.severity} • {alert.alert_type}
                    </p>
                  </div>
                  <Link href="/dashboard/deals" className="text-sm font-medium text-cyan hover:opacity-90 whitespace-nowrap">
                    View Deal ->
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="xl:col-span-2 bg-surface border border-border rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold">Agent Activity Feed</h2>
            {isRefreshingOverview && <RotateCw className="w-3.5 h-3.5 text-text-muted animate-spin" />}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] pr-1 space-y-3">
            {displayOverview.agent_activity.length === 0 ? (
              <p className="text-text-muted text-sm">No recent agent activity found.</p>
            ) : (
              displayOverview.agent_activity.map((log) => (
                <div key={log.id} className="flex gap-3 items-start border-b border-border pb-3 last:border-0">
                  <div className="mt-0.5 bg-elevated p-1.5 rounded-md">
                    {getAgentIcon(log.agent_type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">{log.action}</p>
                    <p className="text-text-muted text-xs mt-1 font-mono">
                      {new Date(log.created_at).toLocaleString()} • {log.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-bold mb-6">Pipeline Funnel</h2>
        <div className="h-[320px] w-full">
          {!bypassMode && loadingFunnel ? (
            <div className="h-full flex items-center justify-center">
              <RotateCw className="w-6 h-6 animate-spin text-text-muted" />
            </div>
          ) : !displayFunnel || displayFunnel.length === 0 ? (
            <p className="text-text-muted text-center mt-20">No funnel data available</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1A1D26", borderColor: "#4A5168", color: "#fff" }}
                  formatter={(value: number, name: string, props: { payload?: FunnelData }) => {
                    if (!props.payload) return value;
                    if (name === "count") return [`${props.payload.count} deals`, "Count"];
                    return value;
                  }}
                />
                <Funnel
                  dataKey="count"
                  data={displayFunnel}
                  isAnimationActive
                >
                  <LabelList position="inside" fill="#fff" stroke="none" dataKey="stage" formatter={(value: string) => value} />
                  {
                    displayFunnel.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))
                  }
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          )}
        </div>
        {displayFunnel && displayFunnel.length > 0 && (
          <div className="mt-4 text-xs text-text-secondary">
            Total tracked pipeline: {formatCurrency(displayFunnel.reduce((acc, stage) => acc + stage.value, 0))}
          </div>
        )}
      </div>
    </div>
  );
}