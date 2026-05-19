import { useAppStore } from '@/stores/app';
import { ClipboardCheck, X, Scissors, Copy } from 'lucide-react';

interface PasteBarProps {
  currentPath: string;
  onPaste: (paths: string[], mode: 'move' | 'copy', targetPath: string) => Promise<void>;
  onClear: () => void;
}

export default function PasteBar({ currentPath, onPaste, onClear }: PasteBarProps) {
  const { clipboard } = useAppStore();

  if (!clipboard || !clipboard.mode) return null;

  const mode = clipboard.mode; // Type guard to ensure mode is not null

  const handlePaste = async () => {
    await onPaste(clipboard.paths, mode, currentPath);
    onClear();
  };

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-amber-600 border-b border-amber-500">
      <div className="flex items-center gap-2 text-white">
        {mode === 'move' ? (
          <>
            <Scissors className="w-4 h-4" />
            <span className="text-sm font-medium">已剪切 {clipboard.paths.length} 个项目</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            <span className="text-sm font-medium">已复制 {clipboard.paths.length} 个项目</span>
          </>
        )}
        <span className="text-xs opacity-80 ml-2">浏览到目标目录后点击粘贴</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handlePaste}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white text-amber-600 text-xs font-medium hover:bg-amber-50 transition-colors"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          粘贴到此处
        </button>
        <button
          onClick={onClear}
          className="p-1.5 rounded hover:bg-amber-700 text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
