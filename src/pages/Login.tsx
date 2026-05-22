import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth';
import { Eye, EyeOff, Loader2, AlertTriangle, Cpu, HardDrive, Network } from 'lucide-react';
import { authApi } from '@/api/client';
import type { AxiosError } from 'axios';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((s) => s.login);

  // Blinking cursor effect
  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => setShowCursor(s => !s), 500);
    return () => clearInterval(interval);
  }, []);

  // === Easter Egg Features ===
  const [panic, setPanic] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const [scan, setScan] = useState(false);
  const [scanProg, setScanProg] = useState(0);
  const [scanPath, setScanPath] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const triggerPanic = useCallback(() => {
    setPanic(true);
    setTimeout(() => setPanic(false), 3500);
  }, []);

  const triggerScan = useCallback(() => {
    if (scan) return;
    setScan(true);
    setScanProg(0);
    setScanPath('');
    const paths = [
      '/etc/shadow', '/var/log/auth.log', '/root/.ssh/id_rsa',
      '/opt/flux/config.yml', '/proc/self/environ', '/boot/initramfs.img',
    ];
    const start = Date.now();
    const tick = () => {
      const pct = Math.min((Date.now() - start) / 3000 * 100, 100);
      setScanProg(pct);
      setScanPath(paths[Math.floor(pct / 100 * paths.length)] || paths[paths.length - 1]);
      if (pct < 100) requestAnimationFrame(tick);
      else setTimeout(() => { setScan(false); setScanProg(0); setScanPath(''); }, 1000);
    };
    requestAnimationFrame(tick);
  }, [scan]);

  // Matrix Rain effect
  useEffect(() => {
    if (!matrix || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array.from({ length: columns }, () => Math.floor(Math.random() * -120));

    let id: number;
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < drops.length; i++) {
        ctx.fillStyle = `hsl(${120 + Math.random() * 20}, 100%, ${40 + Math.random() * 30}%)`;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      id = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', onResize); };
  }, [matrix]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login(username, password);
      if (res.data.token) {
        login(res.data.token, username);
        window.location.href = '/#/';
        return;
      }
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: string; message?: string }>;
      if (axiosErr.response?.status === 401) {
        setError('ACCESS DENIED: Invalid credentials');
      } else if (axiosErr.response?.data?.error || axiosErr.response?.data?.message) {
        setError(axiosErr.response.data.error || axiosErr.response.data.message || 'REQUEST FAILED');
      } else {
        setError(`SYSTEM ERROR: ${axiosErr.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes panic-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px) rotate(-0.5deg); }
          40% { transform: translateX(6px) rotate(0.5deg); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes panic-glitch {
          0%, 100% { opacity: 1; }
          7% { opacity: 0.3; }
          8% { opacity: 0.9; }
          9% { opacity: 0.2; }
          10% { opacity: 1; }
        }
      `}</style>
      {panic && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" style={{ animation: 'panic-shake 0.12s infinite' }}>
          <div className="text-center font-mono">
            <div className="text-red-500 text-3xl font-bold mb-4 drop-shadow-[0_0_20px_rgba(255,0,0,0.5)]" style={{ animation: 'panic-glitch 0.5s infinite' }}>
              ⚠ KERNEL PANIC ⚠
            </div>
            <div className="text-red-400/80 text-sm space-y-2 mb-6">
              <p>A fatal exception has occurred.</p>
              <p className="text-red-400/60">The system has been halted to prevent damage.</p>
              <div className="mt-4 mx-auto p-3 bg-red-950/30 border border-red-500/30 inline-block text-xs text-left">
                <p className="text-red-400/70">STOP: 0xDEADBEEF</p>
                <p className="text-red-400/70">FLUX_CORE_KERNEL_PANIC</p>
                <p className="text-red-400/70">RIP: 0xCAFEBABE</p>
              </div>
            </div>
            <div className="text-red-500/70 text-xs animate-pulse">Auto-recovering system...</div>
          </div>
        </div>
      )}
      {matrix && (
        <canvas ref={canvasRef} className="fixed inset-0 z-50 pointer-events-none" />
      )}
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* CRT Scanlines effect */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,65,0.03)_2px)]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(0,255,65,0.01)_2px)]" />
      </div>

      {/* Animated grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* Vignette effect */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,black_70%)]" />

      {/* Floating tech elements */}
      <div className="absolute top-10 left-10 text-[#00ff41]/20 font-mono text-xs hidden md:block animate-pulse">
        &gt; SYSTEM_READY
      </div>
      <div className="absolute bottom-10 right-10 text-[#00ff41]/20 font-mono text-xs hidden md:block">
        v1.0.0 // SECURE CONN
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Terminal frame */}
        <div className="relative">
          {/* Top bar with window controls */}
          <div className="bg-[#1a1a1a] rounded-t-lg px-4 py-2 flex items-center gap-2 border-b-2 border-[#00ff41]/30">
            <div className="flex gap-1.5">
              <div
                className="w-3 h-3 rounded-full bg-[#ff5f56] cursor-pointer hover:shadow-[0_0_8px_#ff5f56] transition-all active:scale-90"
                onClick={triggerPanic}
              />
              <div
                className={`w-3 h-3 rounded-full bg-[#ffbd2e] cursor-pointer hover:shadow-[0_0_8px_#ffbd2e] transition-all active:scale-90 ${matrix ? 'shadow-[0_0_10px_#ffbd2e]' : ''}`}
                onClick={() => setMatrix(m => !m)}
              />
              <div
                className="w-3 h-3 rounded-full bg-[#27ca3f] cursor-pointer hover:shadow-[0_0_8px_#27ca3f] transition-all active:scale-90"
                onClick={triggerScan}
              />
            </div>
            <div className="flex-1 text-center">
              <span className="text-[#00ff41]/60 text-xs font-mono">root@flux:~# login</span>
            </div>
          </div>
          {scan && (
            <div className="bg-[#0a0a0a] border-x-2 border-[#00ff41]/20 px-4 py-2">
              <div className="flex items-center gap-2 text-[#00ff41]/60 text-xs font-mono mb-1">
                <span className="animate-pulse">&gt;</span>
                <span>scanning</span>
                <span className="text-[#00ff41]">{Math.floor(scanProg)}%</span>
              </div>
              <div className="h-1.5 bg-[#00ff41]/10 rounded overflow-hidden">
                <div className="h-full bg-[#00ff41] transition-all duration-150 ease-linear rounded" style={{ width: `${scanProg}%` }} />
              </div>
              {scanPath && (
                <div className="flex items-center gap-2 text-[#00ff41]/40 text-[10px] font-mono mt-1 truncate">
                  <span className="shrink-0">$ cat</span>
                  <span className="truncate">{scanPath}</span>
                </div>
              )}
            </div>
          )}

          {/* Terminal content */}
          <div className="bg-[#0a0a0a] border-2 border-t-0 border-[#00ff41]/20 rounded-b-lg p-6 shadow-[0_0_60px_-15px_rgba(0,255,65,0.15)]">
            {/* System status */}
            <div className="mb-6 font-mono text-xs">
              <div className="flex items-center gap-2 text-[#00ff41]/60 mb-2">
                <Cpu className="w-3 h-3" />
                <span>SYSTEM: ONLINE</span>
              </div>
              <div className="flex items-center gap-2 text-[#00ff41]/60 mb-2">
                <HardDrive className="w-3 h-3" />
                <span>STORAGE: CONNECTED</span>
              </div>
              <div className="flex items-center gap-2 text-[#00ff41]/60">
                <Network className="w-3 h-3" />
                <span>NETWORK: SECURE</span>
              </div>
            </div>

            {/* ASCII Art Logo */}
            <div className="mb-6 text-center">
              <pre className="text-[#00ff41] font-mono text-xs leading-tight opacity-90">
{`   ____  _____  ___    ____
  |  _ \\| ____|/ _ \\  |  _ \\
  | | | |  _| | | | | | |_) |
  | |_| | |___| |_| | |  __/
  |____/|_____|\\___/  |_|    `}
              </pre>
              <div className="flex items-center justify-center gap-2 mt-2">
                <h1 className="text-3xl font-bold text-white tracking-wider">FLUX</h1>
                <span className="text-[#00ff41] font-mono text-sm">v1.0</span>
              </div>
              <p className="text-[#00ff41]/60 text-xs font-mono mt-1">Server File Management System</p>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Terminal prompt style */}
              <div className="font-mono text-sm">
                <label className="block text-[#00ff41]/60 text-xs mb-1.5 flex items-center gap-2">
                  <span className="text-[#00ff41]">$</span>
                  <span>Enter username</span>
                </label>
                <div className="relative group">
                  <div className="absolute left-0 top-0 bottom-0 flex items-center px-3 text-[#00ff41]/40 group-focus-within:text-[#00ff41]">
                    <span className="text-sm">&gt;</span>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#00ff41]/30 text-white pl-10 pr-4 py-3 font-mono text-sm focus:outline-none focus:border-[#00ff41] focus:shadow-[0_0_20px_-5px_rgba(0,255,65,0.2)] transition-all"
                    placeholder="admin"
                    required
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00ff41]/40">
                    {showCursor && <span className="animate-pulse">█</span>}
                  </div>
                </div>
              </div>

              <div className="font-mono text-sm">
                <label className="block text-[#00ff41]/60 text-xs mb-1.5 flex items-center gap-2">
                  <span className="text-[#00ff41]">$</span>
                  <span>Enter password</span>
                </label>
                <div className="relative group">
                  <div className="absolute left-0 top-0 bottom-0 flex items-center px-3 text-[#00ff41]/40 group-focus-within:text-[#00ff41]">
                    <span className="text-sm">&gt;</span>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#00ff41]/30 text-white pl-10 pr-12 py-3 font-mono text-sm focus:outline-none focus:border-[#00ff41] focus:shadow-[0_0_20px_-5px_rgba(0,255,65,0.2)] transition-all"
                    placeholder="•••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00ff41]/40 hover:text-[#00ff41] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 rounded bg-[#ff0000]/10 border border-[#ff0000]/30 text-[#ff4444] text-xs font-mono flex items-start gap-2 animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>[ERROR] {error}</span>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#00ff41]/10 border border-[#00ff41]/30 text-[#00ff41] font-mono text-sm font-medium hover:bg-[#00ff41]/20 hover:border-[#00ff41]/50 hover:shadow-[0_0_30px_-10px_rgba(0,255,65,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#00ff41]/10 disabled:hover:shadow-none transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">&gt;&gt;</span>
                    <span>Execute Login</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer info */}
            <div className="mt-6 pt-4 border-t border-[#00ff41]/10 font-mono text-xs text-[#00ff41]/40 text-center">
              <p>{'> Access requires authentication'}</p>
              <p className="mt-1">{'> Unauthorized access will be logged'}</p>
            </div>
          </div>
        </div>

        {/* Bottom glow effect */}
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#00ff41]/5 rounded-full blur-[100px] pointer-events-none" />
      </div>
    </div>
    </>
  );
}
