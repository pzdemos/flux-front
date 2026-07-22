import { useTerminalSettings } from '@/stores/terminal';
import { X, Monitor } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const FONT_FAMILIES = [
  'Menlo, Monaco, "Courier New", monospace',
  '"Fira Code", Menlo, Monaco, monospace',
  '"JetBrains Mono", Menlo, Monaco, monospace',
  '"Source Code Pro", Menlo, Monaco, monospace',
  '"Cascadia Code", Menlo, Monaco, monospace',
  'Consolas, Monaco, monospace',
];

export default function TerminalSettingsDialog({ onClose }: Props) {
  const {
    fontSize, setFontSize,
    fontFamily, setFontFamily,
    theme, setTheme,
    cursorBlink, setCursorBlink,
    scrollback, setScrollback,
    enableLigatures, setEnableLigatures,
  } = useTerminalSettings();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">终端设置</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              字体大小: <span className="text-emerald-400">{fontSize}px</span>
            </label>
            <input
              type="range"
              min="10"
              max="24"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">字体</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white outline-none focus:border-emerald-500"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>{f.split(',')[0].replace(/"/g, '')}</option>
              ))}
            </select>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">主题</label>
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    theme === t
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  {t === 'dark' ? '深色' : '浅色'}
                </button>
              ))}
            </div>
          </div>

          {/* Cursor Blink */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-zinc-300">光标闪烁</span>
            <div
              onClick={() => setCursorBlink(!cursorBlink)}
              className={`relative w-10 h-5 rounded-full transition-colors ${cursorBlink ? 'bg-emerald-600' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cursorBlink ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </label>

          {/* Ligatures */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-zinc-300">连字</span>
            <div
              onClick={() => setEnableLigatures(!enableLigatures)}
              className={`relative w-10 h-5 rounded-full transition-colors ${enableLigatures ? 'bg-emerald-600' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enableLigatures ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </label>

          {/* Scrollback */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              回滚行数: <span className="text-emerald-400">{scrollback.toLocaleString()}</span>
            </label>
            <input
              type="range"
              min="1000"
              max="50000"
              step="1000"
              value={scrollback}
              onChange={(e) => setScrollback(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 transition-colors">
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
