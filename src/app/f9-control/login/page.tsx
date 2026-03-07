'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [error, setError] = useState('');
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return setError('Invalid credentials');

    // MFA Check
    const factors = data.user?.factors || [];
    const totpFactor = factors.find((f) => f.factor_type === 'totp' && f.status === 'verified');

    if (totpFactor) {
      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challenge.error) return setError('MFA challenge failed');
      setFactorId(totpFactor.id);
      setRequiresMfa(true);
    } else {
      // Forcing MFA: If not enrolled, block login. Admin must enroll via CLI/secure script first.
      await supabase.auth.signOut();
      setError('MFA is mandatory. Account not enrolled.');
    }
  };

  const verifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error: mfaError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: factorId, // Challenge ID aligns with factor ID in standard flow
      code: mfaCode,
    });

    if (mfaError) return setError('Invalid MFA code');
    router.push('/f9-control');
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <Shield className="w-12 h-12 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-6">F9 Command</h1>
        
        {error && <div className="p-3 mb-4 bg-red-900/50 text-red-400 text-sm rounded">{error}</div>}

        {!requiresMfa ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <Input type="email" placeholder="System Email" className="bg-gray-800 text-white border-gray-700" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Passphrase" className="bg-gray-800 text-white border-gray-700" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">Authenticate</Button>
          </form>
        ) : (
          <form onSubmit={verifyMfa} className="space-y-4">
            <Input type="text" placeholder="6-digit Authenticator Code" className="bg-gray-800 text-white border-gray-700 text-center tracking-widest text-xl" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required maxLength={6} />
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">Verify Step-Up</Button>
          </form>
        )}
      </div>
    </div>
  );
}