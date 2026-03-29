"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Users,
  DollarSign,
  TrendingDown,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Mail,
  CheckCircle2,
  Activity
} from "lucide-react";
import { SlideOverDrawer } from "@/components/ui/slide-over-drawer";
import { useSession } from "next-auth/react";

// Provide auth token to fetcher
const fetcher = async (url: string, token: string) => {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error('Failed to fetch data');
  }
  return res.json();
};

interface Account {
  id: string;
  company_name: string;
  mrr: number;
  contract_end_date: string;
  churn_score: number;
  churn_reason: string;
  intervention_status: string;
  usage_data: Record<string, any>;
}

interface AccountsResponse {
  items: Account[];
  total: number;
}

export default function RetentionPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  const { data, error, isLoading, mutate } = useSWR<AccountsResponse>(
    token ? [`${baseUrl}/api/retention/accounts`, token] : null,
    ([url, t]) => fetcher(url as string, t as string)
  );

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [filterTie, setFilterTie] = useState<"All" | "Red" | "Amber" | "Green">("All");

  const [intervening, setIntervening] = useState<string | null>(null);
  const [interventionResult, setInterventionResult] = useState<any>(null);

  const filteredAccounts = data?.items?.filter(acc => {
    if (filterTie === "Red") return acc.churn_score > 70;
    if (filterTie === "Amber") return acc.churn_score >= 40 && acc.churn_score <= 70;
    if (filterTie === "Green") return acc.churn_score < 40;
    return true;
  }) || [];

  const handleIntervene = async (accountId: string) => {
    try {
      setIntervening(accountId);
      const res = await fetch(`${baseUrl}/api/retention/intervene/${accountId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const result = await res.json();
      setInterventionResult(result);
      mutate(); // Refresh the list to catch updated status/draft
    } catch (e) {
      console.error(e);
    } finally {
      setIntervening(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 70) return "text-red-500";
    if (score >= 40) return "text-amber-500";
    return "text-green-500";
  };

  const getScoreBg = (score: number) => {
    if (score > 70) return "bg-red-500/10";
    if (score >= 40) return "bg-amber-500/10";
    return "bg-green-500/10";
  };

  const totalAtRisk = data?.items?.filter(a => a.churn_score >= 40).length || 0;
  const revenueAtRisk = data?.items?.filter(a => a.churn_score >= 40).reduce((sum, a) => sum + a.mrr, 0) || 0;
  const avgScore = data?.items?.length ? Math.round(data?.items.reduce((s, a) => s + a.churn_score, 0) / data.items.length) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-mono text-text-primary tracking-tight">Retention</h1>
          <p className="text-text-muted mt-1 font-mono text-sm">Predict churn, automate interventions, save revenue.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex max-h-64 items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-surface-400" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg font-mono">
          Failed to load retention data.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-surface-800 border border-surface-700/50 rounded-lg p-6 relative overflow-hidden group"
            >
              <div className="flex flex-col gap-2">
                <span className="text-sm font-mono text-text-muted flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Accounts at Risk
                </span>
                <span className="text-3xl font-mono text-text-primary">{totalAtRisk}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-surface-800 border border-surface-700/50 rounded-lg p-6 relative overflow-hidden group"
            >
              <div className="flex flex-col gap-2">
                <span className="text-sm font-mono text-text-muted flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-500" /> Revenue at Risk
                </span>
                <span className="text-3xl font-mono text-text-primary">${revenueAtRisk.toLocaleString()}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-surface-800 border border-surface-700/50 rounded-lg p-6 relative overflow-hidden group"
            >
              <div className="flex flex-col gap-2">
                <span className="text-sm font-mono text-text-muted flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-500" /> Avg Risk Score
                </span>
                <span className="text-3xl font-mono text-text-primary">{avgScore}/100</span>
              </div>
            </motion.div>
          </div>

          <div className="bg-surface-800 border border-surface-700/50 rounded-lg flex flex-col pt-4">
            <div className="flex gap-2 px-6 pb-4 border-b border-surface-700/50 overflow-x-auto">
              {["All", "Red", "Amber", "Green"].map((tie) => (
                <button
                  key={tie}
                  onClick={() => setFilterTie(tie as any)}
                  className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded border transition-colors whitespace-nowrap ${
                    filterTie === tie
                      ? "bg-surface-600 border-surface-500 text-text-primary"
                      : "bg-surface-900 border-surface-700 text-text-muted hover:bg-surface-700"
                  }`}
                >
                  {tie} ({tie === "All" ? data?.items.length : data?.items?.filter(a => {
                    if (tie === "Red") return a.churn_score > 70;
                    if (tie === "Amber") return a.churn_score >= 40 && a.churn_score <= 70;
                    return a.churn_score < 40;
                  }).length})
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-700 bg-surface-900/50">
                    <th className="py-3 px-6 text-xs font-mono text-text-muted uppercase tracking-wider">Company</th>
                    <th className="py-3 px-6 text-xs font-mono text-text-muted uppercase tracking-wider">MRR</th>
                    <th className="py-3 px-6 text-xs font-mono text-text-muted uppercase tracking-wider">Risk Score</th>
                    <th className="py-3 px-6 text-xs font-mono text-text-muted uppercase tracking-wider hidden md:table-cell">Reason</th>
                    <th className="py-3 px-6 text-xs font-mono text-text-muted uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/50">
                  {filteredAccounts.map((account) => (
                    <tr 
                      key={account.id} 
                      className="hover:bg-surface-700/20 transition-colors cursor-pointer group"
                      onClick={() => setSelectedAccount(account)}
                    >
                      <td className="py-4 px-6 font-mono text-sm text-text-primary flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${account.churn_score > 70 ? 'bg-red-500' : account.churn_score >= 40 ? 'bg-amber-500' : 'bg-green-500'}`} />
                        {account.company_name}
                      </td>
                      <td className="py-4 px-6 font-mono text-sm text-text-muted">${account.mrr.toLocaleString()}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-sm font-bold ${getScoreColor(account.churn_score)}`}>
                            {account.churn_score}
                          </span>
                          <div className="w-16 h-1.5 bg-surface-900 rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className={`h-full ${account.churn_score > 70 ? 'bg-red-500' : account.churn_score >= 40 ? 'bg-amber-500' : 'bg-green-500'}`}
                              style={{ width: `${account.churn_score}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-text-muted hidden md:table-cell max-w-xs truncate">
                        {account.churn_reason || "Normal usage"}
                      </td>
                      <td className="py-4 px-6">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if(account.churn_score >= 40) handleIntervene(account.id);
                          }}
                          disabled={intervening === account.id || account.churn_score < 40}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs transition-colors ${
                            account.churn_score >= 40 
                            ? 'bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 border border-brand-500/20' 
                            : 'bg-surface-700 text-surface-400 border border-surface-600 cursor-not-allowed'
                          }`}
                        >
                          {intervening === account.id ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...</>
                          ) : (
                            <><ShieldAlert className="w-3.5 h-3.5" /> Intervene</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm font-mono text-text-muted">
                        No accounts match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedAccount && (
        <SlideOverDrawer
          isOpen={true}
          onClose={() => {
            setSelectedAccount(null);
            setInterventionResult(null);
          }}
          title={`${selectedAccount.company_name} - Health Profile`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-surface-900 rounded border border-surface-700">
              <div className="space-y-1">
                <span className="text-xs font-mono text-text-muted uppercase">Risk Score</span>
                <div className={`text-2xl font-mono font-bold ${getScoreColor(selectedAccount.churn_score)}`}>
                  {selectedAccount.churn_score} / 100
                </div>
              </div>
              <div className="space-y-1 text-right">
                <span className="text-xs font-mono text-text-muted uppercase">MRR</span>
                <div className="text-xl font-mono text-text-primary">
                  ${selectedAccount.mrr.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-mono text-text-muted flex items-center gap-2 uppercase tracking-wide">
                <Activity className="w-4 h-4" /> Detected Risk Signals
              </h3>
              <div className="p-4 bg-surface-800 rounded border border-surface-700 font-mono text-sm leading-relaxed text-text-primary">
                {selectedAccount.churn_reason || "No immediate risk factors automatically detected. Account appears stable."}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-mono text-text-muted flex items-center gap-2 uppercase tracking-wide">
                <TrendingDown className="w-4 h-4" /> Usage Metrics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-surface-800 rounded border border-surface-700">
                  <div className="text-xs font-mono text-text-muted mb-1">Logins / Mo</div>
                  <div className="text-lg font-mono">{selectedAccount.usage_data?.login_frequency ?? "N/A"}</div>
                </div>
                <div className="p-4 bg-surface-800 rounded border border-surface-700">
                  <div className="text-xs font-mono text-text-muted mb-1">Adopted Features</div>
                  <div className="text-lg font-mono">{selectedAccount.usage_data?.feature_adoption ?? 0}%</div>
                </div>
                <div className="p-4 bg-surface-800 rounded border border-surface-700">
                  <div className="text-xs font-mono text-text-muted mb-1">Avg Ticket Sat</div>
                  <div className="text-lg font-mono">{selectedAccount.usage_data?.avg_ticket_sentiment ?? 0}</div>
                </div>
                <div className="p-4 bg-surface-800 rounded border border-surface-700">
                  <div className="text-xs font-mono text-text-muted mb-1">NPS</div>
                  <div className="text-lg font-mono">{selectedAccount.usage_data?.nps ?? "N/A"}</div>
                </div>
              </div>
            </div>
            
            {(selectedAccount.churn_score >= 40 || selectedAccount.usage_data?.latest_intervention_draft) && (
               <div className="space-y-3 pt-6 border-t border-surface-700/50">
                  <h3 className="text-sm font-mono text-brand-400 flex items-center gap-2 uppercase tracking-wide">
                    <ShieldAlert className="w-4 h-4" /> Recommended Intervention
                  </h3>
                  
                  {(!selectedAccount.usage_data?.latest_intervention_draft && !interventionResult) ? (
                    <div className="p-4 bg-brand-500/5 border border-brand-500/20 rounded">
                      <p className="font-mono text-sm text-text-muted mb-4 opacity-80">
                        AI has not generated a recovery plan yet. Run an intervention to generate an outreach draft.
                      </p>
                      <button 
                        onClick={() => handleIntervene(selectedAccount.id)}
                        disabled={intervening === selectedAccount.id}
                        className="w-full flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 font-mono text-sm font-bold rounded transition-colors disabled:opacity-50"
                      >
                         {intervening === selectedAccount.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                         Generate Outreach Play
                      </button>
                    </div>
                  ) : (
                    <motion.div 
                      className="p-4 bg-brand-500/5 border border-brand-500/20 rounded space-y-4"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                    >
                      <div className="flex gap-2 items-center">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-mono font-bold text-text-primary">
                          Recommended Action: {selectedAccount.intervention_status || interventionResult?.intervention || "Executive check-in"}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-xs font-mono text-text-muted uppercase">Drafted Outreach</span>
                        <div className="p-3 bg-surface-900 border border-surface-700 rounded font-mono text-sm whitespace-pre-wrap text-text-primary/90">
                          {selectedAccount.usage_data?.latest_intervention_draft || interventionResult?.email_draft}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button className="flex-1 bg-brand-600 border border-brand-500 text-white px-3 py-1.5 rounded font-mono text-sm text-center font-bold hover:bg-brand-500 transition-colors">
                          Send Email via Gmail
                        </button>
                      </div>
                    </motion.div>
                  )}
               </div>
            )}
          </div>
        </SlideOverDrawer>
      )}
    </div>
  );
}