"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  QrCode,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { formatINRPrecise, isValidIndianPlate } from "@/lib/utils";
import { Booking, ParkingSlot } from "@/types";

const SmartParkingCanvas = dynamic(
  () =>
    import("@/components/three/SmartParkingCanvas").then(
      (m) => m.SmartParkingCanvas
    ),
  { ssr: false }
);

export default function DriverBookingPage() {
  const { lots, bookings, createBookingAndVerifyPayment } = useParkwise();

  const [selectedLotId, setSelectedLotId] = useState<number>(lots[0]?.id || 1);
  const [activeFloor, setActiveFloor] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);

  const [vehicleNumber, setVehicleNumber] = useState<string>("MH-01-AB-4589");
  const [driverName, setDriverName] = useState<string>("Aarav Sharma");
  const [driverPhone, setDriverPhone] = useState<string>("+91-9811045210");
  const [durationHours, setDurationHours] = useState<number>(2);
  const [paymentMethod, setPaymentMethod] = useState<string>(
    "UPI / FASTag Auto-Debit"
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(
    null
  );

  const selectedLot = useMemo(
    () => lots.find((l) => l.id === selectedLotId) || lots[0],
    [lots, selectedLotId]
  );

  const floorSlots = useMemo(
    () => selectedLot.slots.filter((s) => s.floor === activeFloor),
    [selectedLot, activeFloor]
  );

  const selectedSlot: ParkingSlot | null = useMemo(
    () =>
      selectedLot.slots.find((s) => s.id === selectedSlotId) ||
      floorSlots.find((s) => s.status === "AVAILABLE") ||
      null,
    [selectedLot, selectedSlotId, floorSlots]
  );

  // Live Server-Grade Pricing Calculation
  const pricing = useMemo(() => {
    if (!selectedSlot) {
      return { base: 0, gst: 0, total: 0, rate: 0, surge: 1 };
    }
    let hourly = selectedLot.base_hourly_rate_inr;
    if (selectedSlot.slot_type === "EV_CHARGING") {
      hourly += selectedLot.ev_surcharge_inr;
    } else if (selectedSlot.slot_type === "SUV_XL") {
      hourly += 25;
    }
    const surge = selectedLot.dynamic_pricing_enabled
      ? selectedLot.current_surge_multiplier
      : 1.0;
    const base = Math.round(hourly * durationHours * surge * 100) / 100;
    const gst = Math.round(base * 0.18 * 100) / 100;
    const total = Math.round((base + gst) * 100) / 100;
    return { base, gst, total, rate: hourly, surge };
  }, [selectedLot, selectedSlot, durationHours]);

  async function handleReserveAndPay(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedSlot) {
      setErrorMsg("Please select an available parking bay.");
      return;
    }

    if (!isValidIndianPlate(vehicleNumber)) {
      setErrorMsg(
        "Please enter a valid Indian registration number (e.g., DL-08-CAF-8921 or MH-01-AB-4589)."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const start = new Date();
      const end = new Date(start.getTime() + durationHours * 3600 * 1000);
      const created = await createBookingAndVerifyPayment({
        lotId: selectedLot.id,
        slotId: selectedSlot.id,
        vehicleNumber,
        driverName,
        driverPhone,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        paymentMethod,
      });
      setConfirmedBooking(created);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to complete reservation."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Application 02 • B2C Driver Mobility App
          </span>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            Smart Bay Reservation &amp; Instant QR Gate Pass
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("2D")}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              viewMode === "2D"
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            2D Interactive Bay Matrix
          </button>
          <button
            type="button"
            onClick={() => setViewMode("3D")}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              viewMode === "3D"
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            3D Three.js Spatial Deck
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* LEFT COLUMN: Lot Selector + Floor & Slot Visualizer */}
        <div className="space-y-6 lg:col-span-7">
          {/* Facility Selector Cards */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Select Metropolitan Parking Hub
            </label>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {lots.map((lot) => {
                const isSelected = lot.id === selectedLot.id;
                return (
                  <button
                    key={lot.id}
                    type="button"
                    onClick={() => {
                      setSelectedLotId(lot.id);
                      setSelectedSlotId(null);
                      setErrorMsg(null);
                    }}
                    className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-brand-600 bg-brand-50/40 ring-2 ring-brand-600/20"
                        : "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700 border border-slate-200">
                          {lot.city}
                        </span>
                        <span className="text-xs font-bold text-brand-600">
                          ₹{lot.base_hourly_rate_inr}/hr
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-900">
                        {lot.name}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-slate-500">
                      <span className="text-emerald-600 font-semibold">
                        {lot.available_slots} / {lot.total_slots} Bays Free
                      </span>
                      <span>Surge: {lot.current_surge_multiplier}x</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Floor Switcher & Interactive Slot Map */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  2. Select Deck Floor &amp; Bay
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  {selectedLot.name} — Floor 0{activeFloor}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2].map((fl) => (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => setActiveFloor(fl)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                      activeFloor === fl
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Floor 0{fl}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === "3D" ? (
              <div className="mt-4">
                <SmartParkingCanvas
                  slots={selectedLot.slots}
                  activeFloor={activeFloor}
                  selectedSlotId={selectedSlot?.id || null}
                  onSelectSlot={(slot) => {
                    setSelectedSlotId(slot.id);
                    setErrorMsg(null);
                  }}
                />
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {floorSlots.map((slot) => {
                  const isChosen = selectedSlot?.id === slot.id;
                  const isAvailable = slot.status === "AVAILABLE";

                  let badgeStyle =
                    "border-slate-200 bg-white hover:border-brand-400 text-slate-800";
                  if (isChosen) {
                    badgeStyle =
                      "border-brand-600 bg-brand-600 text-white shadow-stripe";
                  } else if (slot.status === "RESERVED") {
                    badgeStyle =
                      "border-amber-200 bg-amber-50/80 text-amber-800 cursor-not-allowed";
                  } else if (slot.status === "OCCUPIED") {
                    badgeStyle =
                      "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed";
                  } else if (slot.status === "MAINTENANCE") {
                    badgeStyle =
                      "border-red-200 bg-red-50/70 text-red-700 cursor-not-allowed";
                  }

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => {
                        setSelectedSlotId(slot.id);
                        setErrorMsg(null);
                      }}
                      className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all ${badgeStyle}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-extrabold">
                          {slot.slot_number}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                            isChosen
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {slot.slot_type.replace("_", " ")}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-[11px] font-semibold">
                        <span>{slot.status}</span>
                        {slot.power_kw && <span>⚡ {slot.power_kw}kW</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Vehicle Telemetry, Pricing Breakdown & Razorpay Checkout */}
        <div className="space-y-6 lg:col-span-5">
          <form
            onSubmit={handleReserveAndPay}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  Transactional Checkout
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Driver &amp; ANPR Vehicle Details
                </h2>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                Razorpay Sandbox Mode
              </span>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3.5 border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Selected Bay</span>
                <p className="mt-0.5 font-mono text-sm font-extrabold text-slate-900">
                  {selectedSlot ? selectedSlot.slot_number : "None"} (
                  {selectedSlot?.slot_type})
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Bay Status</span>
                <p className="mt-0.5 font-bold text-brand-600">
                  {selectedSlot?.status || "N/A"}
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="vehicle-plate"
                className="block text-xs font-bold text-slate-700"
              >
                Indian Vehicle Registration Number (ANPR Match)
              </label>
              <input
                id="vehicle-plate"
                type="text"
                required
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="MH-01-AB-4589"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm font-bold uppercase text-slate-900 focus:border-brand-600 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Validated against RTO standard format for optical gate entry.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="driver-name"
                  className="block text-xs font-bold text-slate-700"
                >
                  Driver Full Name
                </label>
                <input
                  id="driver-name"
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="driver-phone"
                  className="block text-xs font-bold text-slate-700"
                >
                  Mobile Number (SMS/WhatsApp Pass)
                </label>
                <input
                  id="driver-phone"
                  type="text"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="duration-select"
                  className="block text-xs font-bold text-slate-700"
                >
                  Reservation Duration
                </label>
                <select
                  id="duration-select"
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                >
                  {[1, 2, 3, 4, 6, 8, 12, 24].map((hrs) => (
                    <option key={hrs} value={hrs}>
                      {hrs} {hrs === 1 ? "Hour" : "Hours"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="payment-method"
                  className="block text-xs font-bold text-slate-700"
                >
                  Payment Rail
                </label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                >
                  <option value="UPI / FASTag Auto-Debit">
                    UPI / FASTag Auto-Debit
                  </option>
                  <option value="Razorpay UPI (GPay / PhonePe)">
                    Razorpay UPI (GPay / PhonePe)
                  </option>
                  <option value="Corporate Fleet Wallet">
                    Corporate Fleet Wallet
                  </option>
                </select>
              </div>
            </div>

            {/* Transparent Server-Computed Fare Breakdown */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>
                  Base Tariff ({formatINRPrecise(pricing.rate)}/hr ×{" "}
                  {durationHours}h)
                </span>
                <span className="font-semibold">
                  {formatINRPrecise(pricing.rate * durationHours)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>AI Dynamic Surge Multiplier</span>
                <span className="font-mono font-bold text-brand-600">
                  {pricing.surge.toFixed(2)}x
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST + SGST (18% GST India)</span>
                <span className="font-semibold">
                  {formatINRPrecise(pricing.gst)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
                <span>Total Payable Amount</span>
                <span className="text-brand-600">
                  {formatINRPrecise(pricing.total)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedSlot}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3.5 text-sm font-bold text-white shadow-stripe transition-all hover:bg-brand-700 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? "Acquiring Slot Lock & Verifying HMAC..."
                  : `Pay ${formatINRPrecise(pricing.total)} & Generate QR Gate Pass`}
              </span>
            </button>
          </form>

          {/* Instant Signed QR Gate Pass Card */}
          {confirmedBooking && (
            <div className="rounded-3xl border-2 border-emerald-500 bg-white p-6 shadow-apple space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  CONFIRMED &amp; HMAC SIGNED
                </span>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {confirmedBooking.booking_reference}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-xs">
                <div>
                  <span className="text-slate-400">Vehicle Plate</span>
                  <p className="font-mono text-sm font-bold text-slate-900">
                    {confirmedBooking.vehicle_number}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Assigned Bay</span>
                  <p className="font-mono text-sm font-bold text-brand-600">
                    {confirmedBooking.slot_number}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Cryptographic Signature</span>
                  <p className="truncate font-mono text-[11px] font-semibold text-slate-700">
                    {confirmedBooking.qr_signature}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <Link
                  href={`/gate?ref=${encodeURIComponent(
                    confirmedBooking.booking_reference
                  )}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Scan Pass at Gate Terminal →</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
