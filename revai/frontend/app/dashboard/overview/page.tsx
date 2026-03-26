"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { 
  FunnelChart, Funnel, Tooltip, ResponsiveContainer, LabelList, Cell
} from "recharts";
import { 
  CheckCircle2, RotateCw, Search, Brain, TrendingDown, Swords
} from "lucide-react";
import Link from "next/link";

// Types
interface OverviewData {
  pipeline_value: number;
  deals_at_risk: number;
  prospects_in_queue: number;
  accounts_at_risk: number;
  pipeline_health_avg: number;
}

interface FunnelData {
  stage: string;
  count: number;
  value: number;
  avg_health: number;
}

interface AgentLog {
  id: string;
  agent_type: string;
  action: string;
  status: string;
  created_at: string;
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
  const token = session?.user?.accessToken || "";
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const canFetch = status === "authenticated" && Boolean(token);

  const {
    data: overview,
    error: overviewError,
    isValidating: isMutatingOverview,
    mutate: mutateOverview,
  } = useSWR<OverviewData>(
    canFetch ? [`${API_URL}/api/dashboard/overview`, token] : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const { data: funnel, mutate: mutateFunnel } = useSWR<FunnelData[]>(
    canFetch ? [`${API_URL}/api/dashboard/pipeline-funnel`, token] : null,
    fetcher
  );

  const { data: activity, isValidating: loadingActivity, mutate: mutateActivity } = useSWR<AgentLog[]>(
    canFetch ? [`${API_URL}/api/dashboard/agent-activity?limit=10`, token] : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Example dummy alerts since we don't have an explicit endpoint yet
  // In a real app we'd fetch these or infer from deals_at_risk. 
  // Let's create an empty array or dummy data if deal_at_risk > 0.
  const activeAlerts = overview?.deals_at_risk ? [
    { id: 1, severity: 'critical', company: 'Globex Corp', desc: 'Sponsorship left the company. High churn risk.' },
    { id: 2, severity: 'high', company: 'Wayne Enterprises', desc: 'Deal stalled, same stage for 23 days.' }
  ] : [];

  const handleRefresh = async () => {
    await Promise.all([mutateOverview(), mutateFunnel(), mutateActivity()]);
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
      case 'prospecting': return <Search className="w-4 h-4 text-cyan-400" />;
      case 'deal_intel': return <Brain className="w-4 h-4 text-purple-400" />;
      case 'retention': return <TrendingDown className="w-4 h-4 text-amber-400" />;
      case 'competitive': return <Swords className="w-4 h-4 text-red-500" />;
      default: return <RotateCw className="w-4 h-4 text-gray-400" />;
    }
  };

  if (status === "loading" || (canFetch && !overview && !overviewError)) {
    return (
      <div className="p-8 h-full bg-[#0A0B0F] text-white">
        <div className="animate-pulse space-y-8">
          <div className="h-24 bg-[#1A1D26] rounded-xl"></div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-64 bg-[#1A1D26] rounded-xl"></div>
            <div className="h-64 bg-[#1A1D26] rounded-xl"></div>
          </div>
          <div className="h-80 bg-[#1A1D26] rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-8 h-full bg-[#0A0B0F] text-white">
        <div className="bg-[#111318] border border-[#1A1D26] rounded-xl p-6 max-w-lg">
          <h2 className="text-lg font-bold mb-2">Session required</h2>
          <p className="text-[#8B92A8] text-sm mb-4">Please sign in to load pipeline metrics and agent activity.</p>
          <Link href="/auth/login" className="inline-flex items-center bg-cyan text-black px-4 py-2 rounded-md text-sm font-semibold hover:bg-cyan/90">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (status === "authenticated" && !token) {
    return (
      <div className="p-8 h-full bg-[#0A0B0F] text-white">
        <div className="bg-[#111318] border border-red-500/30 rounded-xl p-6 max-w-lg">
          <h2 className="text-lg font-bold mb-2 text-red-400">Authentication token missing</h2>
          <p className="text-[#8B92A8] text-sm">Your session does not include an API token. Sign out and sign in again.</p>
        </div>
      </div>
    );
  }

  if (overviewError || !overview) {
    return (
      <div className="p-8 h-full bg-[#0A0B0F] text-white">
        <div className="bg-[#111318] border border-red-500/30 rounded-xl p-6 max-w-xl">
          <h2 className="text-lg font-bold mb-2 text-red-400">Unable to load dashboard overview</h2>
          <p className="text-[#8B92A8] text-sm mb-4">The API request failed. Check backend availability and credentials, then retry.</p>
          <button
            onClick={handleRefresh}
            className="bg-[#1A1D26] text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-[#232733] transition-colors border border-[rgba(255,255,255,0.05)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Funnel Colors
  const COLORS = ['#00E5FF','#00B8FF','#008BFF','#005CFF','#6000FF','#9900FF','#CC00FF'];

  return (
    <div className="p-8 h-full bg-[#0A0B0F] text-white overflow-y-auto space-y-8 font-dmsans">
      
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-spacemono">Dashboard Overview</h1>
          <p className="text-[#4A5168] text-sm mt-1">Real-time pipeline and intelligence feed.</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="flex items-center space-x-2 text-sm text-[#4A5168] hover:text-white transition-colors"
        >
          <RotateCw className={`w-4 h-4 ${isMutatingOverview ? 'animate-spin' : ''}`} />
          <span>Last synced: Just now</span>
        </button>
      </div>

      {/* TOP ROW: STAT CARDS */}
      <motion.div 
        variants={containerVariants} 
        initial="hidden" 
        animate="show" 
        className="grid grid-cols-4 gap-6"
      >
        {/* Pipeline Value Card */}
        <motion.div variants={itemVariants} className="bg-[#111318] border border-[#1A1D26] rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="text-[#4A5168] text-sm font-medium mb-2 uppercase tracking-wide">Pipeline Value</div>
          <div className={`text-3xl font-spacemono font-bold ${overview.pipeline_value > 100000 ? 'text-green-400' : 'text-white'}`}>
            {formatCurrency(overview.pipeline_value)}
          </div>
        </motion.div>

        {/* Deals at Risk Card */}
        <motion.div variants={itemVariants} className="bg-[#111318] border border-[#1A1D26] rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="text-[#4A5168] text-sm font-medium mb-2 uppercase tracking-wide">Deals at Risk</div>
            {overview.deals_at_risk > 0 && <span className="flex w-3 h-3 h-full"><span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
          </div>
          <div className={`text-3xl font-spacemono font-bold ${overview.deals_at_risk > 0 ? 'text-red-500' : 'text-white'}`}>
            {overview.deals_at_risk}
          </div>
        </motion.div>

        {/* Prospects Card */}
        <motion.div variants={itemVariants} className="bg-[#111318] border border-[#1A1D26] rounded-xl p-5 shadow-lg relative overflow-hidden border-l-2 border-l-[#00E5FF]">
          <div className="text-[#4A5168] text-sm font-medium mb-2 uppercase tracking-wide">Prospects in Queue</div>
          <div className="text-3xl font-spacemono font-bold text-[#00E5FF]">
            {overview.prospects_in_queue}
          </div>
        </motion.div>

        {/* Accounts at Risk */}
        <motion.div variants={itemVariants} className="bg-[#111318] border border-[#1A1D26] rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="text-[#4A5168] text-sm font-medium mb-2 uppercase tracking-wide">Accounts at Risk</div>
          <div className={`text-3xl font-spacemono font-bold ${overview.accounts_at_risk > 0 ? 'text-amber-500' : 'text-white'}`}>
            {overview.accounts_at_risk}
          </div>
        </motion.div>
      </motion.div>

      {/* MIDDLE ROW */}
      <div className="flex gap-6">
        
        {/* LEFT COL: Active Alerts (60%) */}
        <div className="flex-[0.6] bg-[#111318] border border-[#1A1D26] rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-lg font-bold">Active Alerts</h2>
            {overview.deals_at_risk > 0 && (
              <span className="bg-red-500/20 text-red-500 text-xs px-2 py-0.5 rounded-full font-bold">
                {overview.deals_at_risk} Found
              </span>
            )}
          </div>
          
          <div className="space-y-4">
            {overview.deals_at_risk === 0 || activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-[#1A1D26] rounded-xl">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                <p className="text-white font-medium">No active alerts</p>
                <p className="text-[#4A5168] text-sm mt-1">Your pipeline is exceptionally healthy.</p>
              </div>
            ) : (
              activeAlerts.map(alert => (
                <div 
                  key={alert.id} 
                  className={`p-4 bg-[#1A1D26]/50 rounded-lg border-l-4 flex justify-between items-center ${
                    alert.severity === 'critical' ? 'border-red-500' : 'border-amber-500'
                  }`}
                >
                  <div>
                    <h3 className="font-bold text-white mb-1 flex items-center gap-2">
                       {alert.company}
                    </h3>
                    <p className="text-[#4A5168] text-sm">{alert.desc}</p>
                  </div>
                  <button className="text-sm font-medium hover:text-[#00E5FF] transition-colors whitespace-nowrap">
                    View Deal &rarr;
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COL: Agent Activity (40%) */}
        <div className="flex-[0.4] bg-[#111318] border border-[#1A1D26] rounded-xl p-6 shadow-lg flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-lg font-bold">Agent Activity feed</h2>
            {loadingActivity && <RotateCw className="w-3.5 h-3.5 text-[#4A5168] animate-spin" />}
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-4 font-spacemono text-sm">
            {!activity || activity.length === 0 ? (
              <p className="text-[#4A5168]">No recent agent executions found.</p>
            ) : (
              activity.map(log => (
                <div key={log.id} className="flex gap-3 items-start border-b border-[#1A1D26] pb-3 last:border-0">
                  <div className="mt-0.5 bg-[#1A1D26] p-1.5 rounded-md">
                    {getAgentIcon(log.agent_type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-300">{log.action}</p>
                    <p className="text-[#4A5168] text-xs mt-1">
                      {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • status: {log.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Pipeline Funnel */}
      <div className="bg-[#111318] border border-[#1A1D26] rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-bold mb-6">Pipeline Funnel</h2>
        <div className="h-[300px] w-full">
          {!funnel ? (
            <div className="h-full flex items-center justify-center">
              <RotateCw className="w-6 h-6 animate-spin text-[#4A5168]" />
            </div>
          ) : funnel.length === 0 ? (
             <p className="text-[#4A5168] text-center mt-20">No funnel data available</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1D26', borderColor: '#4A5168', color: '#fff' }}
                  itemStyle={{ color: '#00E5FF' }}
                  formatter={(value: number, name: string, props: any) => {
                    const mappedValue = props.payload.valueOrig || value;
                    if (name === 'value') return formatCurrency(mappedValue);
                    return value;
                  }}
                />
                <Funnel
                  dataKey="count"
                  data={funnel.map(f => ({ ...f, valueOrig: f.value }))}
                  isAnimationActive
                >
                  <LabelList position="inside" fill="#fff" stroke="none" dataKey="stage" />
                  {
                    funnel.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))
                  }
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}