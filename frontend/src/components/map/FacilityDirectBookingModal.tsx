"use client";

import React, { useState } from "react";
import {
  Car,
  CheckCircle2,
  Clock,
  Compass,
  CreditCard,
  MapPin,
  Navigation,
  QrCode,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  DirectFacilityBookingRequest,
  DirectFacilityBookingResponse,
  FacilityEntrance,
  ParkingFacilitySummary,
  bookFacilityDirect,
} from "@/lib/facilityApi";

interface FacilityDirectBookingModalProps {
  facility: ParkingFacilitySummary;
  isOpen: boolean;
  onClose: () => void;
  onStartNavigation?: (facility: ParkingFacilitySummary, entrance?: FacilityEntrance) => void;
}

export function FacilityDirectBookingModal({
  facility,
  isOpen,
  onClose,
  onStartNavigation,
}: FacilityDirectBookingModalProps) {
  // Booking Form State
  const [vehicleNumber, setVehicleNumber] = useState("DL-08-CAF-8921");
  const [vehicleType, setVehicleType] = useState("SEDAN");
  const [driverName, setDriverName] = useState("Aarav Sharma");
  const [driverPhone, setDriverPhone] = useState("+919876543210");
  const [durationHours, setDurationHours] = useState(2);
  const [evChargingRequested, setEvChargingRequested] = useState(false);

  // Status & Confirmation State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<DirectFacilityBookingResponse | null>(null);

  if (!isOpen) return null;

  const baseRate = facility.base_hourly_rate_inr;
  const subtotal = baseRate * durationHours;
  const evFee = evChargingRequested ? 150 : 0;
  const totalAmount = subtotal + evFee;

  const handleConfirmBooking = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: DirectFacilityBookingRequest = {
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        vehicle_type: vehicleType,
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim(),
        duration_hours: durationHours,
        ev_charging_requested: evChargingRequested,
        entrance_id: facility.primary_entrance?.id,
      };

      const res = await bookFacilityDirect(facility.id, payload);
      setBookingResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Unable to reserve parking slot. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNavClick = () => {
    if (onStartNavigation && bookingResult) {
      onStartNavigation(facility, bookingResult.assigned_entrance);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-700/80 bg-slate-900 p-6 text-slate-100 shadow-2xl backdrop-blur-xl transition-all">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {!bookingResult ? (
          <div>
            {/* Modal Header */}
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              <span>Instant Map Booking</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-white">{facility.name}</h2>
            <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{facility.formatted_address}</span>
            </p>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mt-4 rounded-xl border border-rose-500/50 bg-rose-500/10 p-3 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* Booking Form Fields */}
            <div className="mt-5 space-y-4">
              {/* Vehicle Number Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Vehicle License Plate
                </label>
                <div className="relative flex items-center">
                  <Car className="absolute left-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g. DL-08-CAF-8921"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-9 pr-3 py-2 text-sm font-mono text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Vehicle Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Vehicle Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["SEDAN", "SUV", "EV", "2-WHEELER"].map((vt) => (
                    <button
                      key={vt}
                      type="button"
                      onClick={() => {
                        const val = vt === "2-WHEELER" ? "TWO_WHEELER" : vt;
                        setVehicleType(val);
                        if (val === "EV") setEvChargingRequested(true);
                      }}
                      className={`rounded-xl py-1.5 text-xs font-bold transition border ${
                        vehicleType === (vt === "2-WHEELER" ? "TWO_WHEELER" : vt)
                          ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/30"
                          : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {vt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selector */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Parking Duration</span>
                  <span className="text-blue-400 font-mono">{durationHours} Hours</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 4, 8, 24].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setDurationHours(hrs)}
                      className={`rounded-xl py-1.5 text-xs font-bold transition border ${
                        durationHours === hrs
                          ? "bg-blue-600 border-blue-500 text-white shadow"
                          : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {hrs === 24 ? "1 Day" : `${hrs}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* EV Charging Add-on Toggle */}
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-700/80 bg-slate-800/50 cursor-pointer hover:bg-slate-800/80 transition">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      60kW EV HyperCharging Bay
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Reserve designated charger bay with CCS-2 plug
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={evChargingRequested}
                  onChange={(e) => setEvChargingRequested(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 accent-blue-600"
                />
              </label>

              {/* Assigned Entrance Gate Preview */}
              {facility.primary_entrance && (
                <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-slate-300">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Assigned Ingress Gate
                    </span>
                    <span className="font-mono text-emerald-400">
                      Clearance: {facility.primary_entrance.height_clearance_meters}m
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-200">
                    {facility.primary_entrance.gate_name} ({facility.primary_entrance.gate_code})
                  </div>
                </div>
              )}
            </div>

            {/* Pricing Summary */}
            <div className="mt-5 rounded-2xl border border-slate-700/80 bg-slate-950/60 p-3.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>
                  Base Rate (₹{baseRate}/h × {durationHours}h)
                </span>
                <span className="font-mono">₹{subtotal}</span>
              </div>
              {evChargingRequested && (
                <div className="flex justify-between text-xs text-emerald-400 mt-1">
                  <span>EV HyperCharging Add-on</span>
                  <span className="font-mono">+₹150</span>
                </div>
              )}
              <div className="mt-2.5 pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold text-white">
                <span>Total Amount</span>
                <span className="text-lg font-mono text-emerald-400">₹{totalAmount}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmBooking}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Allocating Bay...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    <span>Confirm & Book (₹{totalAmount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Confirmation Success Screen */
          <div className="text-center py-2 animate-fade-in">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h3 className="mt-3 text-lg font-bold text-white">Booking Confirmed!</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Your parking slot and ingress barrier are locked in.
            </p>

            {/* Booking Details Card */}
            <div className="mt-4 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4 text-left space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Booking Reference</span>
                <span className="font-mono text-xs font-bold text-blue-400">
                  {bookingResult.booking_reference}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Allotted Parking Bay</span>
                <span className="font-mono text-sm font-black text-emerald-400">
                  {bookingResult.assigned_slot_number}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Level / Floor</span>
                <span className="text-slate-200 font-medium">
                  {bookingResult.assigned_slot_floor}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Assigned Gate</span>
                <span className="text-slate-200 font-bold">
                  {bookingResult.assigned_entrance.gate_name} (
                  {bookingResult.assigned_entrance.gate_code})
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Paid</span>
                <span className="font-mono font-bold text-slate-200">
                  ₹{bookingResult.total_amount_inr}
                </span>
              </div>
            </div>

            {/* QR Pass Preview */}
            <div className="mt-4 flex items-center justify-between p-3 rounded-2xl border border-blue-500/30 bg-blue-950/30">
              <div className="flex items-center gap-2.5">
                <QrCode className="h-6 w-6 text-blue-400" />
                <div className="text-left">
                  <div className="text-xs font-bold text-blue-200">Smart QR Pass Ready</div>
                  <div className="text-[10px] text-blue-300/80 font-mono">
                    Token: {bookingResult.qr_token.slice(0, 16)}...
                  </div>
                </div>
              </div>
              <span className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            {/* Post-Booking Action Buttons */}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleStartNavClick}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-500 shadow-xl shadow-blue-600/40 transition"
              >
                <Navigation className="h-4 w-4" />
                <span>Start Outdoor Navigation to Gate</span>
              </button>

              <div className="flex gap-2">
                <a
                  href={bookingResult.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  <Compass className="h-3.5 w-3.5 text-blue-400" />
                  <span>Google Maps</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  View on Map
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
