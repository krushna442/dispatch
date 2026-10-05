import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { BASE } from '../utils/api';

export function useSocket(event: string, callback: (data: unknown) => void) {
  const socketRef = useRef<Socket | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const socket = io(BASE, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on(event, (data: unknown) => callbackRef.current(data));
    return () => {
      socket.off(event);
      socket.disconnect();
    };
  }, [event]);

  return socketRef;
}
