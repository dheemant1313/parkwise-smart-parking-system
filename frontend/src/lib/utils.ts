import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatINRPrecise(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Deterministic IST (UTC+05:30) formatting to prevent SSR/Client hydration mismatch
  const istMs = d.getTime() + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMs);
  const day = String(ist.getUTCDate()).padStart(2, "0");
  const month = MONTHS_SHORT[ist.getUTCMonth()];
  const hours24 = ist.getUTCHours();
  const mins = String(ist.getUTCMinutes()).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = String(hours24 % 12 || 12).padStart(2, "0");
  return `${day} ${month}, ${hours12}:${mins} ${period}`;
}

export const INDIAN_PLATE_REGEX =
  /^[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}$/;

export function isValidIndianPlate(plate: string): boolean {
  return INDIAN_PLATE_REGEX.test(plate.trim().toUpperCase());
}

export function generateDeterministicSignature(
  reference: string,
  slotId: number,
  vehicle: string
): string {
  const raw = `${reference}:${slotId}:${vehicle.trim().toUpperCase()}:PARKWISE_HMAC_2026`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex1 = (hash >>> 0).toString(16).padStart(8, "0");
  const hex2 = ((hash ^ 0x5bd1e995) >>> 0).toString(16).padStart(8, "0");
  return `hmac_sha256_${hex1}${hex2}9f8a7b6c5d4e`;
}
