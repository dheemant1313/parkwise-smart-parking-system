"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { formatINRPrecise } from "@/lib/utils";
import { Booking } from "@/types";
import { DriverSubNav } from "@/components/driver/DriverSubNav";
import { QrPassModal } from "@/components/driver/QrPassModal";
import { Canvas3DSkeleton } from "@/components/ui/Skeleton";

const SmartParkingCanvas = dynamic(
  () =>
    import("@/components/three/SmartParkingCanvas").then(
      (m) => m.SmartParkingCanvas
    ),
  {
    ssr: false,
    loading: () => <Canvas3DSkeleton heightClass="h-[380px]" />,
  }
);

export default function ParkingLotDetailPage() {
  const params = useParams();
  const {
    lots,
    vehicles,
    profile,
    createBookingAndVerifyPayment,
    getAIForecast,
  } = useParkwise();

  const lotId = Number(params?.id || 1);
  const lot = useMemo(
    () => lots.find((l) => l.id === lotId) || lots[0],
    [lots, lotId]
  );

  const aiForecast = useMemo(
    () => getAIForecast(lot.id),
    [getAIForecast, lot.id]
  );

  const primaryVeh = vehicles.find((v) => v.isPrimary) || vehicles[0];
  const [activeFloor, setActiveFloor] = useState<number>(1);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [durationHours, setDurationHours] = useState<number>(2);
  const [vehicleNumber, setVehicleNumber] = useState<string>(
    primaryVeh?.plateNumber || "DL-08-CAF-8921"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modalBooking, setModalBooking] = useState<Booking | null>(null);

  const floorSlots = useMemo(
    () => lot.slots.filter((s) => s.floor === activeFloor),
    [lot.slots, activeFloor]
  );

  const selectedSlot = useMemo(
    () =>
      lot.slots.find((s) => s.id === selectedSlotId) ||
      floorSlots.find((s) => s.status === "AVAILABLE") ||
      null,
    [lot.slots, selectedSlotId, floorSlots]
  );

  const totalAmount = useMemo(() => {
    if (!selectedSlot) return 0;
    let rate = lot.base_hourly_rate_inr;
    if (selectedSlot.slot_type === "EV_CHARGING") rate += lot.ev_surcharge_inr;
    if (selectedSlot.slot_type === "SUV_XL") rate += 25;
    const surge = lot.dynamic_pricing_enabled
      ? lot.current_surge_multiplier
      : 1;
    return Math.round(rate * durationHours * surge * 1.18 * 100) / 100;
  }, [lot, selectedSlot, durationHours]);

  async function handleQuickBook() {
    setErrorMsg(null);
    if (!selectedSlot) return;
    try {
      const start = new Date();
      const end = new Date(start.getTime() + durationHours * 3600000);
      const created = await createBookingAndVerifyPayment({
        lotId: lot.id,
        slotId: selectedSlot.id,
        vehicleNumber,
        driverName: profile.fullName,
        driverPhone: profile.phone,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        paymentMethod: "UPI / FASTag Auto-Debit",
      });
      setModalBooking(created);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Booking rejected by server."
      );
    }
  }

  return (
    <div className="min-h-screen bg-surface-soft pb-20">
      <DriverSubNav />

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8 space-y-8">
        {/* Top Facility Header & Switcher */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <Link
              href="/driver"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Driver Search &amp; Map</span>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {lots.map((l) => (
                <Link
                  key={l.id}
                  href={`/driver/lots/${l.id}`}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    l.id === lot.id
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {l.city} ({l.code})
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-brand-600 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                  {lot.code}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  KYC Verified Operator: {lot.operator_name}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {lot.rating}
                </span>
              </div>

              <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {lot.name}
              </h1>
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <MapPin className="h-4 w-4 text-brand-600" />
                <span>
                  {lot.address} • GPS ({lot.latitude.toFixed(4)}° N,{" "}
                  {lot.longitude.toFixed(4)}° E)
                </span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 lg:col-span-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Base Tariff
                </span>
                <p className="mt-1 text-lg font-extrabold text-slate-900">
                  ₹{lot.base_hourly_rate_inr}/hr
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Open Bays
                </span>
                <p className="mt-1 text-lg font-extrabold text-emerald-600">
                  {lot.available_slots}/{lot.total_slots}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  AI Surge
                </span>
                <p className="mt-1 text-lg font-extrabold text-brand-600">
                  {lot.current_surge_multiplier.toFixed(2)}x
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Digital Twin + Quick Checkout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900">
                3D Spatial Garage Inspection — Floor 0{activeFloor}
              </h2>
              <div className="flex gap-2">
                {[1, 2].map((fl) => (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => setActiveFloor(fl)}
                    className={`rounded-xl px-3 py-1 text-xs font-bold ${
                      activeFloor === fl
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    Floor 0{fl}
                  </button>
                ))}
              </div>
            </div>

            <SmartParkingCanvas
              slots={lot.slots}
              activeFloor={activeFloor}
              selectedSlotId={selectedSlot?.id || null}
              onSelectSlot={(s) => setSelectedSlotId(s.id)}
              heightClass="h-[390px]"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple lg:col-span-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-brand-600">
                  Direct Facility Reservation
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Book Bay {selectedSlot?.slot_number || "N/A"}
                </h3>
              </div>
              <Sparkles className="h-5 w-5 text-brand-600" />
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">
                  Vehicle Registration Plate
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) =>
                    setVehicleNumber(e.target.value.toUpperCase())
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Duration</label>
                <select
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-900"
                >
                  {[1, 2, 3, 4, 6, 8].map((h) => (
                    <option key={h} value={h}>
                      {h} Hours
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>AI Demand Insight</span>
                <span className="font-bold text-brand-600">
                  {aiForecast.current_occupancy_pct}% Occupied
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
                <span>Total (incl. 18% GST)</span>
                <span className="text-brand-600">
                  {formatINRPrecise(totalAmount)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleQuickBook}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-xs font-bold text-white shadow-stripe hover:bg-brand-700"
            >
              <CreditCard className="h-4 w-4" />
              <span>
                Instant Reserve &amp; Generate QR Pass (
                {formatINRPrecise(totalAmount)})
              </span>
            </button>
          </div>
        </div>
      </div>

      <QrPassModal
        booking={modalBooking}
        onClose={() => setModalBooking(null)}
      />
    </div>
  );
}
