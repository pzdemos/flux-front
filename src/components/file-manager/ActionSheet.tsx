import type { FileItem } from '@/types';
import {
  Folder,
  File as FileIcon,
  Download,
  Edit3,
  Lock,
  Scissors,
  Copy,
  FileArchive,
  Trash2
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  file: FileItem | null;
  onAction: (action: string) => void;
}

export default function ActionSheet({ open, onClose, file, onAction }: ActionSheetProps) {
  if (!file) return null;

  const actions = [
    { id: 'open', label: file.isDirectory ? '打开' : '编辑', icon: file.isDirectory ? Folder : FileIcon, color: 'text-zinc-400' },
    { id: 'download', label: '下载', icon: Download, color: 'text-zinc-400' },
    { id: 'rename', label: '重命名', icon: Edit3, color: 'text-zinc-400' },
    { id: 'chmod', label: '修改权限', icon: Lock, color: 'text-zinc-400' },
    { id: 'move', label: '移动', icon: Scissors, color: 'text-amber-400' },
    { id: 'copy', label: '复制', icon: Copy, color: 'text-sky-400' },
    ...(file.name.endsWith('.zip') || file.name.endsWith('.tar') || file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz')
      ? [{ id: 'extract', label: '解压', icon: FileArchive, color: 'text-zinc-400' }]
      : []
    ),
    ...(!file.isDirectory && !(file.name.endsWith('.zip') || file.name.endsWith('.tar') || file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz'))
      ? [{ id: 'compress', label: '压缩', icon: FileArchive, color: 'text-zinc-400' }]
      : []
    ),
    { id: 'divider', label: '', icon: null, color: '' },
    { id: 'delete', label: '删除', icon: Trash2, color: 'text-red-400' },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="bg-zinc-900 border-zinc-800">
        <SheetHeader className="text-left">
          <SheetTitle className="text-white flex items-center gap-2">
            {file.isDirectory ? <Folder className="w-5 h-5 text-amber-400" /> : <FileIcon className="w-5 h-5 text-zinc-400" />}
            <span className="truncate">{file.name}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-4 gap-2 py-4">
          {actions.map((action) => {
            if (action.id === 'divider') {
              return (
                <div key="divider" className="col-span-4 border-t border-zinc-800 my-2" />
              );
            }

            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => {
                  onAction(action.id);
                  onClose();
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-zinc-800/60 transition-colors"
              >
                {Icon && <Icon className={`w-6 h-6 ${action.color}`} />}
                <span className="text-xs text-zinc-400">{action.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-sm font-medium"
        >
          取消
        </button>
      </SheetContent>
    </Sheet>
  );
}
