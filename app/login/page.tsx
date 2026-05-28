'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { Building2, Mail, Eye, EyeOff, LogIn, RefreshCw, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= 5) {
        setError('Too many failed attempts. Please wait a few minutes before trying again.');
      } else if (newAttempts >= 3) {
        setError(`Invalid email or password. ${5 - newAttempts} attempt${5 - newAttempts === 1 ? '' : 's'} remaining.`);
      } else {
        setError('Invalid email or password. Please try again.');
      }
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
          padding: '36px 40px 32px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Building2 size={28} color="#1e3a5f" />
          </div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>
            HRMO Biometrics Sender
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            Sign in to access the dashboard
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '36px 40px' }}>
          <form onSubmit={handleLogin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Email */}
              <div>
                <label className="label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    style={{ paddingLeft: 40 }}
                  />
                  <Mail size={15} style={{
                    position: 'absolute', left: 12, top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--gray-400)',
                  }} />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: 10, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--gray-400)', display: 'flex',
                    }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: 'var(--danger)',
                fontWeight: 500,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  {error}
                  {/* Attempt dots */}
                  {attempts > 0 && attempts < 5 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <div key={n} style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: n <= attempts ? 'var(--danger)' : 'rgba(220,38,38,0.2)',
                          transition: 'background 0.2s',
                        }} />
                      ))}
                      <span style={{ fontSize: 10, color: 'var(--danger)', marginLeft: 4 }}>
                        {attempts}/5 attempts
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', marginTop: 4, padding: '12px 0', fontSize: 14 }}>
                {loading
                  ? <><RefreshCw size={15} className="spin" /> Signing in…</>
                  : <><LogIn size={15} /> Sign In</>}
              </button>

            </div>
          </form>

          <div style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid var(--gray-200)',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--gray-400)',
          }}>
            Human Resource Management Office · 2026
          </div>
        </div>
      </div>
    </div>
  );
}