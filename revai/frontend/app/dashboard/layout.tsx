import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-base overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-base flex flex-col">
        <div className="p-8 pb-12 flex-1 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}