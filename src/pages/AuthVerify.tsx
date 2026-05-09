import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyPass } from '../lib/api';
import { motion } from 'motion/react';

export default function AuthVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    const pass = searchParams.get('pass');
    if (!pass) {
      setStatus('error');
      return;
    }

    verifyPass(pass).then(ok => {
      if (ok) {
        // Clean the URL so the token doesn't stay in browser history
        navigate('/', { replace: true });
      } else {
        setStatus('error');
      }
    });
  }, []); // run once on mount

  if (status === 'loading') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 text-slate-800 dark:text-white">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-slate-800 dark:border-t-white"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-sm font-medium opacity-60">Signing you in…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-4xl">🔗</p>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Link invalide</h1>
      <p className="text-slate-500 dark:text-white/60 max-w-xs">
        This access link is no longer valid. Please contact your MonCivique administrator to get a new link.
      </p>
    </div>
  );
}
