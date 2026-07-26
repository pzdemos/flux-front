import { Loader2, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  detail,
  confirmText = '确定',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className={`bg-zinc-900 border rounded-lg p-5 w-full max-w-md shadow-2xl ${danger ? 'border-rose-900/60' : 'border-zinc-700'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-3">
          {danger && (
            <div className="shrink-0 w-8 h-8 rounded-full bg-rose-500/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-zinc-400 mt-1.5">{message}</p>
            {detail && (
              <p className="text-[11px] text-zinc-500 mt-2 font-mono break-all bg-zinc-950/60 px-2 py-1.5 rounded border border-zinc-800">
                {detail}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed ${
              danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
