import { useState, useEffect } from 'react';
import { systemApi } from '@/api/client';
import { X, Eye, Download, Loader2 } from 'lucide-react';

interface Props {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export default function FilePreviewDialog({ filePath, fileName, onClose }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName);
  const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(fileName);
  const isAudio = /\.(mp3|wav|ogg|aac|flac)$/i.test(fileName);
  const isPdf = /\.pdf$/i.test(fileName);

  useEffect(() => {
    loadPreview();
  }, [filePath]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isImage || isPdf) {
        const res = await systemApi.preview(filePath);
        const blob = new Blob([res.data]);
        setPreviewUrl(URL.createObjectURL(blob));
      } else {
        setPreviewUrl(null);
        setError('此文件类型不支持预览');
      }
    } catch {
      setError('预览加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = `/flux/api/files/download?path=${encodeURIComponent(filePath)}`;
    a.download = fileName;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-semibold text-white truncate">{fileName}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleDownload} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors" title="下载">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-4 overflow-auto flex items-center justify-center">
          {loading ? (
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          ) : error ? (
            <div className="text-center text-zinc-400">
              <Eye className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>{error}</p>
            </div>
          ) : previewUrl ? (
            isImage ? (
              <img src={previewUrl} alt={fileName} className="max-w-full max-h-full object-contain rounded-lg" />
            ) : isPdf ? (
              <iframe src={previewUrl} className="w-full h-full min-h-[60vh] rounded-lg border border-zinc-700" title={fileName} />
            ) : isVideo ? (
              <video src={`/flux/api/files/preview?path=${encodeURIComponent(filePath)}`} controls className="max-w-full max-h-full rounded-lg" />
            ) : isAudio ? (
              <audio src={`/flux/api/files/preview?path=${encodeURIComponent(filePath)}`} controls className="w-full max-w-md" />
            ) : null
          ) : null}
        </div>
      </div>
    </div>
  );
}
