import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_BACKEND_URL
    ? import.meta.env.VITE_BACKEND_URL.replace('/api', '')
    : 'http://localhost:3000';

export const socket = io(URL, {
    autoConnect: true,
    transports: ['websocket', 'polling']
});
