import { useCallback, useEffect, useRef, useState } from 'react';

type RetryDelayFn = (retryCount: number) => number;

type WebSocketOptions = {
    onOpen?: (socket: WebSocket) => void;
    onMessage?: (event: MessageEvent) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (event: Event) => void;
    getRetryDelay?: RetryDelayFn;
    maxQueueSize?: number;
};

const DEFAULT_RETRY_DELAY_MS = 1200;
const MAX_RETRY_DELAY_MS = 15000;
const DEFAULT_QUEUE_LIMIT = 50;

function useLatest<T>(value: T) {
    const ref = useRef(value);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref;
}

export function useWebSocketConnection(url: string | null | undefined, options: WebSocketOptions = {}) {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const retryCountRef = useRef(0);
    const timeoutRef = useRef<number | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const queueRef = useRef<string[]>([]);

    const onOpenRef = useLatest(options.onOpen);
    const onMessageRef = useLatest(options.onMessage);
    const onCloseRef = useLatest(options.onClose);
    const onErrorRef = useLatest(options.onError);
    const getRetryDelayRef = useLatest(options.getRetryDelay);
    const maxQueueSizeRef = useLatest(options.maxQueueSize ?? DEFAULT_QUEUE_LIMIT);

    const sendRaw = useCallback((payload: string) => {
        const currentSocket = socketRef.current;
        if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
            currentSocket.send(payload);
            return;
        }
        queueRef.current.push(payload);
        const limit = maxQueueSizeRef.current;
        if (queueRef.current.length > limit) {
            queueRef.current.splice(0, queueRef.current.length - limit);
        }
    }, [maxQueueSizeRef]);

    const sendJson = useCallback((data: unknown) => {
        sendRaw(JSON.stringify(data));
    }, [sendRaw]);

    useEffect(() => {
        let active = true;
        let ws: WebSocket | null = null;

        const clearTimer = () => {
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };

        const scheduleReconnect = () => {
            clearTimer();
            const getRetryDelay = getRetryDelayRef.current;
            const retryCount = retryCountRef.current;
            const baseDelay = Math.min(MAX_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS * Math.pow(2, retryCount));
            const jitter = baseDelay * (0.2 + Math.random() * 0.2);
            const delay = getRetryDelay ? getRetryDelay(retryCount) : baseDelay + jitter;
            retryCountRef.current += 1;
            timeoutRef.current = window.setTimeout(() => {
                if (active) {
                    connect();
                }
            }, delay);
        };

        if (!url) {
            setIsConnected(false);
            setSocket(null);
            socketRef.current = null;
            return () => {
                active = false;
                clearTimer();
            };
        }

        const connect = () => {
            const socket = new WebSocket(url);
            ws = socket;
            socketRef.current = socket;

            socket.onopen = () => {
                if (!active) {
                    return;
                }
                retryCountRef.current = 0;
                setIsConnected(true);
                setSocket(socket);
                if (queueRef.current.length > 0) {
                    const queued = [...queueRef.current];
                    queueRef.current = [];
                    queued.forEach((payload) => socket.send(payload));
                }
                onOpenRef.current?.(socket);
            };

            socket.onmessage = (event) => {
                onMessageRef.current?.(event);
            };

            socket.onclose = (event) => {
                if (!active) {
                    return;
                }
                setIsConnected(false);
                setSocket(null);
                socketRef.current = null;
                onCloseRef.current?.(event);
                scheduleReconnect();
            };

            socket.onerror = (event) => {
                if (!active) {
                    return;
                }
                setIsConnected(false);
                onErrorRef.current?.(event);
                try {
                    socket.close();
                } catch {
                    // ignore close errors
                }
            };
        };

        connect();

        return () => {
            active = false;
            clearTimer();
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                ws.close();
            }
            socketRef.current = null;
        };
    }, [url, getRetryDelayRef, onCloseRef, onErrorRef, onMessageRef, onOpenRef]);

    return { socket, isConnected, sendJson, sendRaw };
}
