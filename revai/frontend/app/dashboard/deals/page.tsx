import KanbanBoard from "@/components/deals/KanbanBoard";

export default function DealsPage() {
  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-mono font-bold text-white tracking-tight">Deals Pipeline</h1>
          <p className="text-text-muted mt-1 text-sm">Drag and drop active deals across the stages.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-bg-elevated text-white px-4 py-2 text-sm rounded-lg hover:bg-bg-subtle transition-colors border border-border-dim font-medium">
            Filter
          </button>
          <button className="bg-white text-bg-base px-4 py-2 text-sm rounded-lg hover:bg-gray-200 transition-colors font-semibold shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            + New Deal
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <KanbanBoard />
      </div>
    </div>
  );
}