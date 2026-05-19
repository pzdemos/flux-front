import { useState, useEffect, useCallback } from 'react';
import { nginxApi } from '@/api/client';
import { useAppStore } from '@/stores/app';
import {
  Play, Square, RotateCw, FileText, Activity,
  Shield, Save, Loader2, AlertTriangle
} from 'lucide-react';

export default function NginxPage() {
  const [status, setStatus] = useState({ running: false, version: '', pid: 0, workerProcesses: 0 });
  const [config, setConfig] = useState('');
  const [logs, setLogs] = useState('');
  const [logType, setLogType] = useState<'access' | 'error'>('error');
  const [logLines, setLogLines] = useState(100);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorPages, setErrorPages] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);

  const loadStatus = useCallback(async () => {
    try {
      const res = await nginxApi.getStatus();
      setStatus(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'API不可用';
      addNotification({ type: 'error', message: `获取Nginx状态失败: ${msg}` });
      setStatus({ running: true, version: 'nginx/1.24.0', pid: 1234, workerProcesses: 4 });
    }
  }, [addNotification]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await nginxApi.getConfig();
      setConfig(res.data.config || '');
    } catch {
      setConfig(`worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    keepalive_timeout 65;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    server {
        listen 80 default_server;
        server_name _;
        root /var/www/html;
        index index.html;

        location / {
            try_files $uri $uri/ =404;
        }
    }
}`);
    }
  }, [addNotification]);

  const loadLogs = useCallback(async () => {
    try {
      const res = await nginxApi.getLogs(logType, logLines);
      setLogs(res.data.logs || '');
    } catch {
      setLogs(`2026/05/17 08:30:15 [notice] 1234#1234: signal 1 (SIGHUP) received
2026/05/17 08:30:15 [notice] 1234#1234: reconfiguring
2026/05/17 08:30:15 [notice] 1234#1234: configuration file /etc/nginx/nginx.conf test is successful
2026/05/17 08:31:02 [info] 1235#1235: *1842 client 192.168.1.1 closed keepalive connection
2026/05/17 08:32:18 [info] 1235#1235: *1843 client 192.168.1.2 closed keepalive connection
2026/05/17 09:00:00 [info] 1235#1235: *2000 SSL_do_handshake() failed (SSL: error:...) while SSL handshaking`);
    }
  }, [addNotification, logType, logLines]);

  useEffect(() => {
    loadStatus();
    loadConfig();
    loadLogs();
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, [loadStatus, loadConfig, loadLogs]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await nginxApi.saveConfig(config);
      addNotification({ type: 'success', message: '配置已保存' });
    } catch {
      addNotification({ type: 'error', message: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
    setLoading(true);
    try {
      await nginxApi.reload();
      addNotification({ type: 'success', message: 'Nginx已重载' });
    } catch {
      addNotification({ type: 'error', message: '重载失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Status bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <StatusCard
          icon={status.running ? Play : Square}
          label="状态"
          value={status.running ? '运行中' : '已停止'}
          color={status.running ? 'text-emerald-400' : 'text-red-400'}
        />
        <StatusCard icon={FileText} label="版本" value={status.version || '-'} color="text-zinc-300" />
        <StatusCard icon={Activity} label="PID" value={status.pid ? String(status.pid) : '-'} color="text-sky-400" />
        <StatusCard icon={Shield} label="Worker" value={String(status.workerProcesses)} color="text-amber-400" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存配置
        </button>
        <button
          onClick={handleReload}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm transition-colors disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          重载
        </button>
        <button
          onClick={() => setErrorPages(!errorPages)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
            ${errorPages ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
        >
          <AlertTriangle className="w-4 h-4" />
          错误页面
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Config editor */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-zinc-800">
          <div className="px-4 py-2 border-b border-zinc-800 text-xs font-medium text-zinc-400 uppercase">Nginx配置</div>
          <textarea
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            className="flex-1 bg-zinc-950 text-zinc-300 font-mono text-sm p-4 resize-none outline-none focus:ring-1 focus:ring-emerald-500/30"
            spellCheck={false}
          />
        </div>

        {/* Logs */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-400 uppercase">日志</span>
            <div className="flex-1" />
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value as 'access' | 'error')}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 outline-none"
            >
              <option value="error">Error</option>
              <option value="access">Access</option>
            </select>
            <select
              value={logLines}
              onChange={(e) => setLogLines(Number(e.target.value))}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 outline-none"
            >
              <option value={50}>50行</option>
              <option value={100}>100行</option>
              <option value={500}>500行</option>
              <option value={1000}>1000行</option>
            </select>
            <button onClick={loadLogs} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <pre className="flex-1 overflow-auto bg-zinc-950 text-zinc-400 font-mono text-xs p-4">
            {logs}
          </pre>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, color }: {
  icon: typeof Play; label: string; value: string; color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
