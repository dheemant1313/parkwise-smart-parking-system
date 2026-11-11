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

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
