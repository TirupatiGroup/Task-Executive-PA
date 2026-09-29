// 404 page.

import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/common';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-4 text-center">
      <Compass className="text-slate-300" size={44} />
      <h1 className="text-2xl font-semibold text-slate-800">404</h1>
      <p className="text-sm text-slate-500">That page does not exist.</p>
      <Link to="/"><Button variant="secondary">Back to dashboard</Button></Link>
    </div>
  );
}
