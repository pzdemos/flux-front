import { useEffect, useRef, useState, useCallback } from 'react';

export type WSState = 'connecting' | 'open' | 'closing' | 'closed' | 'error';

interface UseWebSocketOptions {
  url: string;
  protocols?: string[];
  onMessage?: (data: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnects?: number;
}

export function useWebSocket({
  url,
  protocols,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnect = true,
  reconnectInterval = 2000,
  maxReconnects = 10,
}: UseWebSocketOptions) {
  const [state, setState] = useState<WSState>('closed');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionallyClosed = useRef(false);

  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;
  onErrorRef.current = onError;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    intentionallyClosed.current = false;
    setState('connecting');

    try {
      const ws = new WebSocket(url, protocols);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectCount.current = 0;
        setState('open');
        onOpenRef.current?.();
      };

      ws.onmessage = (e) => {
        onMessageRef.current?.(e.data);
      };

      ws.onclose = () => {
        setState('closed');
        wsRef.current = null;
        onCloseRef.current?.();

        if (reconnect && !intentionallyClosed.current && reconnectCount.current < maxReconnects) {
          reconnectCount.current++;
          const delay = Math.min(reconnectInterval * reconnectCount.current, 10000);
          reconnectTimer.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (e) => {
        setState('error');
        onErrorRef.current?.(e);
      };
    } catch {
      setState('error');
    }
  }, [url, protocols, reconnect, reconnectInterval, maxReconnects]);

  const disconnect = useCallback(() => {
    intentionallyClosed.current = true;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const send = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      intentionallyClosed.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { state, connect, disconnect, send };
}
