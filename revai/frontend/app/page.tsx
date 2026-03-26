import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-base text-white flex items-center justify-center px-6">
      <section className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-mono font-bold tracking-tight">RevAI Mission Control</h1>
        <p className="text-text-secondary text-base md:text-lg">
          AI-powered revenue operations workspace for prospects, deals, retention, and competitive intelligence.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/auth/login"
            className="bg-cyan text-black px-5 py-2.5 rounded-md font-semibold hover:bg-cyan/90 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard/overview"
            className="bg-elevated text-white px-5 py-2.5 rounded-md border border-border hover:bg-surface transition-colors"
          >
            Open Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
