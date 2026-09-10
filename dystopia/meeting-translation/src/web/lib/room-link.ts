export const createRoomLink = (origin: string, roomId: string, token: string): string => {
  const base = origin.replace(/\/$/, "");
  return `${base}/translate/rooms/${encodeURIComponent(roomId)}#${encodeURIComponent(token)}`;
};
