import { io } from 'socket.io-client';
import { API_URL } from '../config';
import { getStoredToken } from './axios';

/** Mirrors ackitFrontend/src/api/brandSocket.ts (async token for AsyncStorage) */

let socket = null;
const joinedBrandRooms = new Set();

function getSocketUrl() {
  return String(API_URL).replace(/\/$/, '');
}

function rejoinBrandRooms(s) {
  joinedBrandRooms.forEach((configureId) => {
    s.emit('brand:join', configureId);
  });
}

export async function getAppSocket() {
  if (socket?.connected) return socket;

  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: {},
    });

    socket.on('connect', () => {
      rejoinBrandRooms(socket);
    });
  }

  const token = await getStoredToken();
  socket.auth = { token: token || undefined };

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function getBrandSocket() {
  return getAppSocket();
}

export async function joinBrandConfigureRoom(configureId) {
  const id = String(configureId || '').trim();
  if (!id) return;

  joinedBrandRooms.add(id);
  const s = await getAppSocket();
  if (s.connected) {
    s.emit('brand:join', id);
  }
}

export async function leaveBrandConfigureRoom(configureId) {
  const id = String(configureId || '').trim();
  if (!id) return;

  joinedBrandRooms.delete(id);
  if (!socket?.connected) return;
  socket.emit('brand:leave', id);
}

export function disconnectBrandSocket() {
  if (!socket) return;
  joinedBrandRooms.clear();
  socket.disconnect();
  socket = null;
}
