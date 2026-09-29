// Login page - email + password sign-in.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button, Card, Input } from '../components/common';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err?.message || 'Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-800">
            <ShieldCheck className="text-accent-400" size={28} />
          </div>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Executive PA</h1>
          <p className="mt-1 text-sm text-slate-500">Private command centre. Authorized accounts only.</p>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <form onSubmit={handleSignIn} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button className="w-full" type="submit" loading={loading}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
          Single approved user. Calendar access is read-only and only for explicitly shared calendars.
        </p>
      </Card>
    </div>
  );
}
