// Per-room ephemeral guest session (display name + participant id) in localStorage.
const KEY = (roomId: string) => `syncbeat:session:${roomId}`;

export interface GuestSession {
  displayName: string;
  participantId: string;
}

export function getSession(roomId: string): GuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY(roomId));
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch {
    return null;
  }
}

export function setSession(roomId: string, s: GuestSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(roomId), JSON.stringify(s));
}

export function clearSession(roomId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY(roomId));
}
