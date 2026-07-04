export type DeliveryLocationPing = {
  assignmentId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAt: string;
};

const MAX_QUEUE_SIZE = 20;
const MAX_AGE_MS = 10 * 60 * 1000;

export function nextLocationQueue(current: DeliveryLocationPing[], ping: DeliveryLocationPing, now = Date.now()) {
  const fresh = current.filter((item) => now - Date.parse(item.capturedAt) <= MAX_AGE_MS);
  return [...fresh, ping].slice(-MAX_QUEUE_SIZE);
}

export function freshLocationQueue(current: DeliveryLocationPing[], now = Date.now()) {
  return current.filter((item) => now - Date.parse(item.capturedAt) <= MAX_AGE_MS).slice(-MAX_QUEUE_SIZE);
}

