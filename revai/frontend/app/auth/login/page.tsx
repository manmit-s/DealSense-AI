'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError('Invalid credentials');
      } else {
        router.push('/dashboard/overview');
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-md bg-surface border border-border p-8 rounded-xl shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-mono font-bold text-white mb-2">RevAI</h1>
          <p className="text-text-secondary text-sm">Mission Control Login</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red/10 border border-red/20 text-red text-sm rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full bg-elevated border border-border rounded-md px-4 py-2 text-white outline-none focus:border-cyan transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full bg-elevated border border-border rounded-md px-4 py-2 text-white outline-none focus:border-cyan transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-cyan text-base font-bold py-2 px-4 rounded-md hover:bg-cyan/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Authenticating...' : 'Enter System'}
          </button>
        </form>
      </div>
    </div>
  );
}