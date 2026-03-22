import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
});

socket.on('connect', () => {
    console.log('Connected to Socket.IO server,', socket.id);
});

socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected from Socket.IO server:', reason);
});

export default socket;