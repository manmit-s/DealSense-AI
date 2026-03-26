"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CircleUser, AlertCircle } from 'lucide-react';

const STAGES = ['Prospect', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Closed Won'];

// Interfaces
interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  health_score: number;
  last_contact_date?: string;
  assigned_to?: string;
}

const fetcher = async ([url, token]: [string, string]) => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

function calculateDaysAgo(dateString?: string) {
  if (!dateString) return null;
  const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 3600 * 24));
  return days;
}

// ----------------------------------------------------
// Sortable Card Component
// ----------------------------------------------------
function SortableDealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: 'Deal', deal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const daysAgo = calculateDaysAgo(deal.last_contact_date);

  // Health logic
  let borderLeft = 'border-l-green-500';
  let badgeColor = 'bg-green-500/20 text-green-500';
  let isRisk = false;

  if (deal.health_score < 40) {
    borderLeft = 'border-l-red-500';
    badgeColor = 'bg-red-500/20 text-red-500';
    isRisk = true;
  } else if (deal.health_score < 65) {
    borderLeft = 'border-l-amber-500';
    badgeColor = 'bg-amber-500/20 text-amber-500';
  }

  const router = useRouter();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) {
           router.push(`/dashboard/deals/${deal.id}`);
        }
      }}
      className={`
        bg-[#111318] p-4 rounded-xl border border-[#1A1D26] border-l-[3px] 
        ${borderLeft} mb-3 cursor-pointer select-none hover:shadow-[0_0_8px_rgba(255,255,255,0.1)] 
        transition-all hover:-translate-y-[1px]
        ${isRisk ? 'bg-[rgba(255,23,68,0.04)]' : ''}
      `}
    >
       <div className="flex justify-between items-start mb-2">
         <h4 className="font-bold text-sm text-white line-clamp-1">{deal.title}</h4>
         <span className="font-spacemono text-[#00E5FF] text-sm">{formatCurrency(deal.value)}</span>
       </div>
       <div className="flex justify-between items-center text-xs text-[#4A5168] mb-3">
         <span className="px-2 py-0.5 bg-[#1A1D26] rounded-md">{deal.stage}</span>
         {daysAgo !== null && (
           <span className={daysAgo > 7 ? 'text-amber-500 font-medium' : ''}>{daysAgo}d ago</span>
         )}
       </div>
       <div className="flex justify-between items-center">
         <div className="flex items-center gap-1.5 object-cover">
             {deal.assigned_to ? (
                <div className="w-6 h-6 rounded-full bg-cyan-900 flex items-center justify-center text-cyan-100 text-xs font-bold uppercase">
                    {deal.assigned_to.substring(0,2)}
                </div>
             ) : (
                <CircleUser className="w-6 h-6 text-[#4A5168]" />
             )}
         </div>
         <span className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${badgeColor}`}>
            {isRisk && <AlertCircle className="w-3 h-3" />}
            {deal.health_score}
         </span>
       </div>
    </div>
  );
}

// ----------------------------------------------------
// Sortable Column Component
// ----------------------------------------------------
function KanbanColumn({ stage, deals }: { stage: string; deals: Deal[] }) {
  const { setNodeRef } = useSortable({
    id: stage,
    data: { type: 'Column', stage },
  });

  const totalValue = deals.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="flex flex-col w-[320px] min-w-[320px] bg-[#111318]/50 rounded-xl border border-[#1A1D26] h-full">
      <div className="p-3 border-b border-[#1A1D26] flex items-center justify-between pb-3 bg-[#111318] rounded-t-xl sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-white uppercase text-xs tracking-widest">{stage}</h3>
          <span className="bg-[#1A1D26] text-[#4A5168] text-xs px-2 py-0.5 rounded-full font-medium">
            {deals.length}
          </span>
        </div>
        <span className="text-xs text-[#4A5168] font-spacemono">{formatCurrency(totalValue)}</span>
      </div>

      <div ref={setNodeRef} className="flex-1 p-3 overflow-y-auto">
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.length > 0 ? (
            deals.map((deal) => <SortableDealCard key={deal.id} deal={deal} />)
          ) : (
             <div className="border border-dashed border-[#1A1D26] h-24 rounded-xl flex items-center justify-center text-[#4A5168] text-sm">
                Drop here
             </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Main Board Component
// ----------------------------------------------------
export default function KanbanBoard() {
  const { data: session, status } = useSession();
  const token = session?.user?.accessToken || "";
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const canFetch = status === 'authenticated' && Boolean(token);

  const { data: initialDeals, error: dealsError, mutate } = useSWR<Deal[]>(
    canFetch ? [`${API_URL}/api/deals`, token] : null,
    fetcher
  );

  const [deals, setDeals] = useState<Deal[]>([]);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  // Sync SWR -> Local State
  useEffect(() => {
    if (initialDeals) setDeals(initialDeals);
  }, [initialDeals]);

  // Sensors for DnD (Require small move so clicks still fire routing)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'Deal') {
      setActiveDeal(active.data.current.deal as Deal);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveDeal = active.data.current?.type === 'Deal';
    const isOverDeal = over.data.current?.type === 'Deal';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveDeal) return;

    setDeals((prev) => {
      const activeIndex = prev.findIndex((d) => d.id === activeId);
      const activeItem = { ...prev[activeIndex] };

      if (isOverDeal) {
        const overIndex = prev.findIndex((d) => d.id === overId);
        if (activeItem.stage !== prev[overIndex].stage) {
            activeItem.stage = prev[overIndex].stage;
            return arrayMove([...prev.slice(0, activeIndex), activeItem, ...prev.slice(activeIndex + 1)], activeIndex, overIndex);
        }
        return arrayMove(prev, activeIndex, overIndex);
      }

      if (isOverColumn) {
        const overStage = over.data.current?.stage;
        if (activeItem.stage !== overStage) {
            activeItem.stage = overStage;
            // Push at the end
            const newlyArranged = [...prev];
            newlyArranged[activeIndex] = activeItem;
            return arrayMove(newlyArranged, activeIndex, prev.length - 1);
        }
      }
      return prev;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const targetDeal = deals.find(d => d.id === activeId);
    
    if (targetDeal && initialDeals) {
        const originalDeal = initialDeals.find(d => d.id === activeId);
        if (originalDeal && originalDeal.stage !== targetDeal.stage) {
             // API patch
             try {
                const response = await fetch(`${API_URL}/api/deals/${activeId}/stage`, {
                    method: 'PATCH',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ stage: targetDeal.stage })
                });

                if (!response.ok) {
                  throw new Error('Failed to update deal stage');
                }

                mutate(); // Refresh from backend silently
             } catch {
                 // On fail, revert
                 setDeals(initialDeals);
             }
        }
    }
  };

  if (status === 'loading' || (canFetch && !initialDeals)) {
    return <div className="animate-pulse flex gap-6 h-[70vh]">
        {[1,2,3,4].map(idx => <div key={idx} className="w-[320px] bg-[#1A1D26] rounded-xl h-full"></div>)}
    </div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="bg-[#111318] border border-[#1A1D26] rounded-xl p-6 text-[#8B92A8]">
        Please sign in to access the pipeline board.
      </div>
    );
  }

  if (status === 'authenticated' && !token) {
    return (
      <div className="bg-[#111318] border border-red-500/30 rounded-xl p-6 text-red-400">
        Session token is missing. Please sign out and sign in again.
      </div>
    );
  }

  if (dealsError) {
    return (
      <div className="bg-[#111318] border border-red-500/30 rounded-xl p-6 text-[#8B92A8] flex items-center justify-between">
        <span>Unable to load deals from the API.</span>
        <button
          onClick={() => mutate()}
          className="bg-[#1A1D26] text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-[#232733] transition-colors border border-[rgba(255,255,255,0.05)]"
        >
          Retry
        </button>
      </div>
    );
  }

  // Calculate totals
  const totalPipeline = deals.filter(d => d.stage !== 'Closed Lost' && d.stage !== 'Closed Won').reduce((acc, d) => acc + d.value, 0);
  const activeCount = deals.filter(d => d.stage !== 'Closed Lost' && d.stage !== 'Closed Won').length;
  const avgHealth = activeCount > 0 ? Math.round(deals.filter(d => d.stage !== 'Closed Lost' && d.stage !== 'Closed Won').reduce((acc, d) => acc + d.health_score, 0) / activeCount) : 0;
  const riskCount = deals.filter(d => d.health_score < 65 && d.stage !== 'Closed Lost' && d.stage !== 'Closed Won').length;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      
      {/* SUMMARY STATS BAR */}
      <div className="bg-[#111318] border border-[#1A1D26] rounded-xl p-4 mb-6 flex justify-between items-center shadow-md">
         <div className="flex gap-12">
            <div>
              <p className="text-[#4A5168] text-xs font-bold uppercase mb-1">Active Deals</p>
              <p className="text-xl font-bold">{activeCount}</p>
            </div>
            <div>
              <p className="text-[#4A5168] text-xs font-bold uppercase mb-1">Pipeline Value</p>
              <p className="text-xl font-bold font-spacemono text-[#00E5FF]">{formatCurrency(totalPipeline)}</p>
            </div>
            <div>
              <p className="text-[#4A5168] text-xs font-bold uppercase mb-1">Avg Health</p>
              <p className={`text-xl font-bold ${avgHealth >= 65 ? 'text-green-500' : avgHealth >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{avgHealth}</p>
            </div>
            <div>
              <p className="text-[#4A5168] text-xs font-bold uppercase mb-1">At Risk</p>
              <p className={`text-xl font-bold ${riskCount > 0 ? 'text-red-500' : 'text-white'}`}>{riskCount}</p>
            </div>
         </div>
         <button className="bg-[#1A1D26] text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-[#232733] transition-colors border border-[rgba(255,255,255,0.05)]">
            + New Deal
         </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start h-full scrollbar-thin">
           <SortableContext items={STAGES} strategy={verticalListSortingStrategy}>
              {STAGES.map((stage) => (
                 <KanbanColumn 
                    key={stage} 
                    stage={stage} 
                    deals={deals.filter((d) => d.stage === stage)} 
                 />
              ))}
           </SortableContext>

           <DragOverlay>
              {activeDeal ? <SortableDealCard deal={activeDeal} /> : null}
           </DragOverlay>
        </div>
      </DndContext>
    </div>
  );
}
