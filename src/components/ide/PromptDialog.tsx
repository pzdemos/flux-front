import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface PromptDialogProps {
  title: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  busy?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onClose: () => void;
}

export default function PromptDialog({
  title,
  label,
  defaultValue = '',
  placeholder,
  confirmText = '确定',
  busy = false,
  onConfirm,
  onClose,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // 如果有扩展名，光标定位在扩展名前
  useEffect(() => {
    if (defaultValue.includes('.') && inputRef.current) {
      const dotIdx = defaultValue.lastIndexOf('.');
      inputRef.current.setSelectionRange(0, dotIdx);
    }
  }, [defaultValue]);

  const handleConfirm = async () => {
    if (!value.trim() || busy) return;
    await onConfirm(value.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
        {label && <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape' && !busy) onClose();
          }}
          placeholder={placeholder}
          disabled={busy}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!value.trim() || busy}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
