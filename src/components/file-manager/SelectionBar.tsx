import {
  Trash2,
  Scissors,
  Copy,
  FileArchive,
  Edit3,
  X,
  Download,
  ClipboardCheck,
  Unpack
} from 'lucide-react';

interface ClipboardData {
  paths: string[];
  mode: 'move' | 'copy' | null;
}

interface SelectionBarProps {
  count: number;
  onDelete: () => void;
  onMove: () => void;
  onCopy: () => void;
  onCompress: () => void;
  onRename: () => void;
  onDownload: () => void;
  onCancel: () => void;
  clipboard?: ClipboardData | null;
  onPaste?: () => void;
  onClearClipboard?: () => void;
  /** 单选且选中的是压缩文件时显示「解压」而非「压缩」 */
  canExtract?: boolean;
  onExtract?: () => void;
}

export default function SelectionBar({
  count,
  onDelete,
  onMove,
  onCopy,
  onCompress,
  onRename,
  onDownload,
  onCancel,
  clipboard,
  onPaste,
  onClearClipboard,
  canExtract,
  onExtract,
}: SelectionBarProps) {
  const hasClipboard = clipboard && clipboard.mode && onPaste && onClearClipboard;
  const hasSelection = count > 0;

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-2.5 border-b backdrop-blur-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700/50 shadow-lg shadow-black/20">
      <div className="flex items-center gap-3">
        {/* Clipboard paste button with pulse animation */}
        {hasClipboard && (
          <button
            onClick={() => { onPaste!(); onClearClipboard!(); }}
            className="relative group flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20
              text-emerald-200 text-xs font-semibold border border-emerald-500/40
              hover:from-emerald-500/30 hover:to-teal-500/30 hover:border-emerald-500/60 hover:text-emerald-100
              active:scale-95 transition-all duration-200
              animate-pulse-slow shadow-lg shadow-emerald-500/20"
          >
            <ClipboardCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>粘贴 {clipboard.paths.length} 项</span>
            <button
              onClick={(e) => { e.stopPropagation(); onClearClipboard!(); }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-emerald-950
                flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-emerald-400
                transition-all duration-200"
              title="取消粘贴"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </button>
        )}

        {/* Selection count - only show when has selection */}
        {hasSelection && (
          <span className="text-sm font-semibold text-white drop-shadow-lg">
            <span className="text-slate-400">已选择</span> <span className="text-white font-bold">{count}</span> <span className="text-slate-400">项</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hasSelection && (
          <>
            <button
              onClick={onDownload}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-slate-200 text-xs font-medium
                border border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white
                active:scale-95 transition-all duration-200"
            >
              <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span>下载</span>
            </button>
            {canExtract && onExtract ? (
              <button
                onClick={onExtract}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 text-xs font-medium
                  border border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/50 hover:text-emerald-100
                  active:scale-95 transition-all duration-200"
              >
                <Unpack className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>解压</span>
              </button>
            ) : (
              <button
                onClick={onCompress}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-slate-200 text-xs font-medium
                  border border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white
                  active:scale-95 transition-all duration-200"
              >
                <FileArchive className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>压缩</span>
              </button>
            )}
            <button
              onClick={onRename}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-slate-200 text-xs font-medium
                border border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white
                active:scale-95 transition-all duration-200"
            >
              <Edit3 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span>重命名</span>
            </button>
            <div className="w-px h-5 bg-slate-700/50 mx-1" />
            <button
              onClick={onMove}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-200 text-xs font-medium
                border border-indigo-500/30 hover:bg-indigo-500/30 hover:border-indigo-500/50 hover:text-indigo-100
                active:scale-95 transition-all duration-200"
            >
              <Scissors className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span>移动</span>
            </button>
            <button
              onClick={onCopy}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-200 text-xs font-medium
                border border-indigo-500/30 hover:bg-indigo-500/30 hover:border-indigo-500/50 hover:text-indigo-100
                active:scale-95 transition-all duration-200"
            >
              <Copy className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span>复制</span>
            </button>
            <div className="w-px h-5 bg-slate-700/50 mx-1" />
            <button
              onClick={onDelete}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 text-xs font-medium
                border border-rose-500/30 hover:bg-rose-500/30 hover:border-rose-500/50 hover:text-rose-100
                active:scale-95 transition-all duration-200"
            >
              <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span>删除</span>
            </button>
            <button
              onClick={onCancel}
              className="group flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700/50 text-slate-400
                border border-slate-600/50 hover:bg-slate-600/50 hover:text-slate-200
                active:scale-90 transition-all duration-200"
            >
              <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
