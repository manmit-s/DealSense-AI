"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Plus,
  RefreshCcw,
  Shield,
  Swords,
  X,
} from "lucide-react";
import Link from "next/link";

interface BattlecardListItem {
  competitor_name: string;
  last_updated: string;
  alert_count: number;
}

interface ObjectionHandler {
  objection: string;
  response: string;
}

interface Battlecard {
  id: string;
  competitor_name: string;
  overview: string;
  their_strengths: string[];
  their_weaknesses: string[];
  how_we_win: string[];
  key_differentiators: string[];
  objection_handlers: ObjectionHandler[];
  recent_features: string[];
  customer_complaints: string[];
  deal_mentions: string[];
  last_updated: string;
}

interface CompetitiveAlert {
  competitor_name: string;
  deal_title: string;
  severity: string;
  created_at: string;
}

const fetcher = async ([url, token]: [string, string]) => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Request failed");
  }

  return res.json();
};

const timeAgo = (iso: string) => {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "-";
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function CompetitivePage() {
  const { data: session, status } = useSession();
  const token = session?.user?.accessToken || "";
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const canFetch = status === "authenticated" && Boolean(token);

  const [selectedCompetitor, setSelectedCompetitor] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [newCompetitorDomain, setNewCompetitorDomain] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [expandedHandler, setExpandedHandler] = useState<number | null>(null);

  const {
    data: competitors,
    error: competitorsError,
    isLoading: loadingCompetitors,
    mutate: mutateCompetitors,
  } = useSWR<BattlecardListItem[]>(
    canFetch ? [`${API_URL}/api/competitive/battlecards`, token] : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const {
    data: alerts,
    mutate: mutateAlerts,
  } = useSWR<CompetitiveAlert[]>(
    canFetch ? [`${API_URL}/api/competitive/alerts`, token] : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const {
    data: battlecard,
    error: battlecardError,
    isLoading: loadingBattlecard,
    mutate: mutateBattlecard,
  } = useSWR<Battlecard>(
    canFetch && selectedCompetitor
      ? [`${API_URL}/api/competitive/battlecards/${encodeURIComponent(selectedCompetitor)}`, token]
      : null,
    fetcher
  );

  useEffect(() => {
    if (!selectedCompetitor && competitors && competitors.length > 0) {
      setSelectedCompetitor(competitors[0].competitor_name);
    }
  }, [competitors, selectedCompetitor]);

  const selectedAlerts = useMemo(() => {
    if (!alerts || !selectedCompetitor) return [];
    return alerts.filter(
      (alert) =>
        alert.competitor_name.toLowerCase() === selectedCompetitor.toLowerCase()
    );
  }, [alerts, selectedCompetitor]);

  const handleTrackCompetitor = async () => {
    const trimmedName = newCompetitorName.trim();
    if (!trimmedName || !token) return;

    setIsTracking(true);
    try {
      const res = await fetch(`${API_URL}/api/competitive/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          competitor_name: trimmedName,
          competitor_domain: newCompetitorDomain.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to track competitor");

      setIsModalOpen(false);
      setNewCompetitorName("");
      setNewCompetitorDomain("");
      setSelectedCompetitor(trimmedName);

      await Promise.all([mutateCompetitors(), mutateAlerts(), mutateBattlecard()]);
    } finally {
      setIsTracking(false);
    }
  };

  const handleRefreshIntel = async () => {
    if (!selectedCompetitor || !token) return;

    setIsTracking(true);
    try {
      await fetch(`${API_URL}/api/competitive/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          competitor_name: selectedCompetitor,
          competitor_domain: "",
        }),
      });

      await Promise.all([mutateCompetitors(), mutateBattlecard(), mutateAlerts()]);
    } finally {
      setIsTracking(false);
    }
  };

  const copyHandler = async (handler: ObjectionHandler) => {
    await navigator.clipboard.writeText(
      `Objection: ${handler.objection}\n\nResponse: ${handler.response}`
    );
  };

  if (status === "loading") {
    return <div className="animate-pulse rounded-xl bg-elevated h-[560px]" />;
  }

  if (status === "unauthenticated") {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-text-secondary">
        Sign in to access competitive intelligence.
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

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-6 text-text-primary min-h-[640px]">
        <aside className="bg-surface border border-border rounded-xl p-4 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wider text-text-muted">Competitors</h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-elevated border border-border px-2 py-1 text-xs hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              Track New
            </button>
          </div>

          {loadingCompetitors ? (
            <div className="space-y-2">
              <div className="animate-pulse rounded-md h-14 bg-elevated" />
              <div className="animate-pulse rounded-md h-14 bg-elevated" />
              <div className="animate-pulse rounded-md h-14 bg-elevated" />
            </div>
          ) : competitorsError ? (
            <div className="text-sm text-red">Unable to load competitors.</div>
          ) : competitors && competitors.length > 0 ? (
            <div className="space-y-2">
              {competitors.map((item) => {
                const active =
                  selectedCompetitor.toLowerCase() === item.competitor_name.toLowerCase();
                return (
                  <button
                    key={item.competitor_name}
                    onClick={() => setSelectedCompetitor(item.competitor_name)}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                      active
                        ? "bg-elevated border-cyan/40"
                        : "bg-bg-base border-border hover:bg-elevated"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate">{item.competitor_name}</p>
                      {item.alert_count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red/20 text-red border border-red/40">
                          {item.alert_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-1">Updated {timeAgo(item.last_updated)}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-text-muted">
              No competitors tracked yet.
            </div>
          )}
        </aside>

        <main className="bg-surface border border-border rounded-xl p-6">
          {!selectedCompetitor ? (
            <div className="h-full min-h-[560px] flex flex-col items-center justify-center text-center text-text-muted">
              <Shield className="w-8 h-8 mb-3" />
              <p className="font-semibold text-text-primary">Select a competitor to view their battlecard</p>
              <p className="text-sm mt-1">Track a competitor to generate intelligence and active deal alerts.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-mono font-bold">{selectedCompetitor}</h1>
                  <p className="text-sm text-text-muted mt-1">
                    Last updated: {battlecard ? timeAgo(battlecard.last_updated) : "not available"}
                  </p>
                </div>
                <button
                  onClick={handleRefreshIntel}
                  disabled={isTracking}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2 text-sm hover:opacity-90 disabled:opacity-60"
                >
                  {isTracking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="w-4 h-4" />
                  )}
                  Refresh Intel
                </button>
              </div>

              {selectedAlerts.length > 0 && (
                <div className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3">
                  <p className="text-sm text-amber font-semibold">
                    <span className="mr-1">⚔️</span>
                    {selectedCompetitor} mentioned in {selectedAlerts.length} active deal(s) this week
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedAlerts.map((alert, idx) => (
                      <span
                        key={`${alert.deal_title}-${idx}`}
                        className="text-xs px-2 py-1 rounded-md border border-amber/30 bg-bg-base text-amber"
                      >
                        {alert.deal_title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {loadingBattlecard ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="animate-pulse rounded-xl h-44 bg-elevated" />
                  <div className="animate-pulse rounded-xl h-44 bg-elevated" />
                  <div className="animate-pulse rounded-xl h-44 bg-elevated" />
                  <div className="animate-pulse rounded-xl h-44 bg-elevated" />
                </div>
              ) : battlecardError || !battlecard ? (
                <div className="rounded-lg border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
                  Unable to load battlecard data. Try Refresh Intel.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <section className="rounded-xl border border-cyan/30 bg-cyan/5 p-4">
                      <h3 className="font-semibold mb-3">Their Strengths</h3>
                      <ul className="space-y-2 text-sm text-text-secondary">
                        {battlecard.their_strengths.map((item, idx) => (
                          <li key={`${item}-${idx}`} className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 text-cyan" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section className="rounded-xl border border-amber/30 bg-amber/5 p-4">
                      <h3 className="font-semibold mb-3">Their Weaknesses</h3>
                      <ul className="space-y-2 text-sm text-text-secondary">
                        {battlecard.their_weaknesses.map((item, idx) => (
                          <li key={`${item}-${idx}`} className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section className="rounded-xl border border-green/30 bg-green/5 p-4">
                      <h3 className="font-semibold mb-3">How We Win</h3>
                      <ul className="space-y-2 text-sm">
                        {battlecard.how_we_win.map((item, idx) => (
                          <li key={`${item}-${idx}`} className="flex items-start gap-2 text-green font-medium">
                            <Check className="w-4 h-4 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section className="rounded-xl border border-border bg-elevated p-4">
                      <h3 className="font-semibold mb-3">Objection Handlers</h3>
                      <div className="space-y-2">
                        {battlecard.objection_handlers.map((handler, idx) => {
                          const open = expandedHandler === idx;
                          return (
                            <div key={`${handler.objection}-${idx}`} className="rounded-lg border border-border bg-bg-base">
                              <button
                                onClick={() => setExpandedHandler(open ? null : idx)}
                                className="w-full px-3 py-2 text-left flex items-center justify-between gap-2"
                              >
                                <span className="text-sm text-text-primary">{handler.objection}</span>
                                <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
                              </button>
                              {open && (
                                <div className="px-3 pb-3">
                                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{handler.response}</p>
                                  <button
                                    onClick={() => copyHandler(handler)}
                                    className="mt-2 inline-flex items-center gap-1 text-xs text-cyan hover:opacity-80"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    Copy response
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>

                  <section className="rounded-xl border border-border bg-bg-base p-4">
                    <h3 className="font-semibold mb-3">Active Deal Alerts</h3>
                    {selectedAlerts.length > 0 ? (
                      <div className="space-y-2">
                        {selectedAlerts.map((alert, idx) => (
                          <div
                            key={`${alert.deal_title}-${idx}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{alert.deal_title}</p>
                              <p className="text-xs text-text-muted">Severity: {alert.severity}</p>
                            </div>
                            <Link
                              href="/dashboard/deals"
                              className="text-xs text-cyan hover:opacity-80"
                            >
                              View Deal
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted">No active deal mentions for this competitor.</p>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Track New Competitor</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md border border-border bg-elevated p-1.5 hover:opacity-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted uppercase tracking-wider">Competitor Name</label>
                <input
                  value={newCompetitorName}
                  onChange={(e) => setNewCompetitorName(e.target.value)}
                  placeholder="CompetitorX"
                  className="mt-1 w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm outline-none focus:border-cyan"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted uppercase tracking-wider">Domain</label>
                <input
                  value={newCompetitorDomain}
                  onChange={(e) => setNewCompetitorDomain(e.target.value)}
                  placeholder="competitorx.com"
                  className="mt-1 w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm outline-none focus:border-cyan"
                />
              </div>
            </div>

            <button
              onClick={handleTrackCompetitor}
              disabled={isTracking || !newCompetitorName.trim()}
              className="mt-5 w-full rounded-md bg-cyan text-bg-base px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {isTracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              Track Competitor
            </button>
          </div>
        </div>
      )}
    </>
  );
}