import {
  Trash2,
  Scissors,
  Copy,
  FileArchive,
  Share2,
  Edit3,
  X,
  Download
} from 'lucide-react';

interface SelectionBarProps {
  count: number;
  onDelete: () => void;
  onMove: () => void;
  onCopy: () => void;
  onCompress: () => void;
  onShare: () => void;
  onRename: () => void;
  onDownload: () => void;
  onCancel: () => void;
}

export default function SelectionBar({
  count,
  onDelete,
  onMove,
  onCopy,
  onCompress,
  onShare,
  onRename,
  onDownload,
  onCancel,
}: SelectionBarProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-emerald-600 border-b border-emerald-500">
      <span className="text-sm font-medium text-white">已选择 {count} 项</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onDownload}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500 text-white text-xs hover:bg-emerald-400 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />下载
        </button>
        <button
          onClick={onCompress}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500 text-white text-xs hover:bg-emerald-400 transition-colors"
        >
          <FileArchive className="w-3.5 h-3.5" />压缩
        </button>
        <button
          onClick={onShare}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500 text-white text-xs hover:bg-emerald-400 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />分享
        </button>
        <button
          onClick={onRename}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500 text-white text-xs hover:bg-emerald-400 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />重命名
        </button>
        <button
          onClick={onMove}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-sky-600 text-white text-xs hover:bg-sky-500 transition-colors"
        >
          <Scissors className="w-3.5 h-3.5" />移动
        </button>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-sky-600 text-white text-xs hover:bg-sky-500 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />复制
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-600 text-white text-xs hover:bg-red-500 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />删除
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 text-xs hover:bg-zinc-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
