"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  History,
  MapPin,
  PlusCircle,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { formatDateTime, formatINR } from "@/lib/utils";
import { DriverSubNav } from "@/components/driver/DriverSubNav";
import { QrPassModal } from "@/components/driver/QrPassModal";
import { Booking } from "@/types";

export default function DriverBookingsPage() {
  const {
    bookings,
    notifications,
    cancelBooking,
    extendBooking,
    markAllNotificationsRead,
  } = useParkwise();

  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE_CONFIRMED" | "COMPLETED" | "CANCELLED"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQrBooking, setSelectedQrBooking] = useState<Booking | null>(
    null
  );
  const [busyBookingRef, setBusyBookingRef] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter === "ACTIVE_CONFIRMED") {
        if (b.status !== "CONFIRMED" && b.status !== "ACTIVE") return false;
      } else if (statusFilter === "COMPLETED") {
        if (b.status !== "COMPLETED") return false;
      } else if (statusFilter === "CANCELLED") {
        if (b.status !== "CANCELLED") return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = b.booking_reference.toLowerCase().includes(q);
        const matchPlate = b.vehicle_number.toLowerCase().includes(q);
        const matchLot = b.lot_name.toLowerCase().includes(q);
        const matchCity = b.city.toLowerCase().includes(q);
        if (!matchRef && !matchPlate && !matchLot && !matchCity) return false;
      }
      return true;
    });
  }, [bookings, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const activeCount = bookings.filter(
      (b) => b.status === "CONFIRMED" || b.status === "ACTIVE"
    ).length;
    const validBookings = bookings.filter((b) => b.status !== "CANCELLED");
    const totalSpent = validBookings.reduce(
      (acc, b) => acc + b.total_amount_inr,
      0
    );
    const totalGst = validBookings.reduce(
      (acc, b) => acc + b.gst_amount_inr,
      0
    );
    const unreadNotifs = notifications.filter((n) => !n.read).length;
    return { activeCount, totalSpent, totalGst, unreadNotifs };
  }, [bookings, notifications]);

  const handleExtend = async (bookingRef: string, hours: number) => {
    setBusyBookingRef(bookingRef);
    setFeedback(null);
    try {
      const updated = await extendBooking(bookingRef, hours);
      setFeedback({
        type: "success",
        text: `Booking ${updated.booking_reference} extended by +${hours}h (New total: ${updated.duration_hours}h • ${formatINR(updated.total_amount_inr)}).`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Unable to extend parking session.",
      });
    } finally {
      setBusyBookingRef(null);
    }
  };

  const handleCancel = async (bookingRef: string) => {
    setBusyBookingRef(bookingRef);
    setFeedback(null);
    try {
      const updated = await cancelBooking(bookingRef);
      setFeedback({
        type: "success",
        text: `Reservation ${updated.booking_reference} cancelled. Bay ${updated.slot_number} released and full refund (${formatINR(updated.total_amount_inr)}) initiated via Razorpay.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Unable to cancel this reservation.",
      });
    } finally {
      setBusyBookingRef(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <DriverSubNav />

      {/* Header */}
      <section className="border-b border-slate-200/80 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <History className="h-3.5 w-3.5" />
                <span>PASSES, EXTENSIONS, CANCELLATIONS & GST RECEIPTS</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                My Bookings &amp; Digital Passes
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage active QR gate passes, extend parking duration remotely,
                cancel reservations for instant refunds, or download 18% GST tax
                invoices.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/driver"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <PlusCircle className="h-4 w-4" />
                Book Another Bay
              </Link>
              <Link
                href="/gate"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <QrCode className="h-4 w-4 text-blue-600" />
                Test QR at Gate Terminal
              </Link>
            </div>
          </div>

          {/* Summary KPI Row */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
              <p className="text-xs font-medium text-slate-500">
                Active / Confirmed Passes
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-600">
                {stats.activeCount}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Ready for ANPR / QR entry
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
              <p className="text-xs font-medium text-slate-500">
                Cumulative Parking Spend
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatINR(stats.totalSpent)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Net of cancelled passes
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
              <p className="text-xs font-medium text-slate-500">
                18% GST Input Credit
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {formatINR(stats.totalGst)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                SAC 996743 compliant
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
              <p className="text-xs font-medium text-slate-500">
                Receipt &amp; Gate Alerts
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {notifications.length}{" "}
                {stats.unreadNotifs > 0 && (
                  <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                    {stats.unreadNotifs} new
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Real-time webhook ledger
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        {feedback && (
          <div
            className={`mb-6 flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-medium shadow-sm ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold underline opacity-75 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left 8 Cols: Booking Cards */}
          <div className="space-y-5 lg:col-span-8">
            {/* Filter & Search Bar */}
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "ALL", label: `All (${bookings.length})` },
                  { id: "ACTIVE_CONFIRMED", label: "Active & Confirmed" },
                  { id: "COMPLETED", label: "Completed" },
                  { id: "CANCELLED", label: "Cancelled / Refunded" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        tab.id as
                          | "ALL"
                          | "ACTIVE_CONFIRMED"
                          | "COMPLETED"
                          | "CANCELLED"
                      )
                    }
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      statusFilter === tab.id
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ref, plate, city..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Bookings List */}
            {filteredBookings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <QrCode className="mx-auto h-10 w-10 text-slate-400" />
                <h3 className="mt-3 text-base font-bold text-slate-900">
                  No reservations match your filter
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Book an available standard, EV charging, or accessible bay to
                  generate an HMAC-signed QR pass.
                </p>
                <Link
                  href="/driver"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Find Parking Now
                </Link>
              </div>
            ) : (
              filteredBookings.map((booking) => {
                const isBusy = busyBookingRef === booking.booking_reference;
                const canExtend =
                  booking.status === "CONFIRMED" || booking.status === "ACTIVE";
                const canCancel = booking.status === "CONFIRMED";

                return (
                  <div
                    key={booking.booking_reference}
                    className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm transition hover:border-blue-200"
                  >
                    {/* Card Top Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {booking.booking_reference}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            booking.status === "CONFIRMED"
                              ? "bg-blue-100 text-blue-700"
                              : booking.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-700"
                                : booking.status === "COMPLETED"
                                  ? "bg-slate-200 text-slate-800"
                                  : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {booking.status}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            booking.payment.status === "REFUNDED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          Payment: {booking.payment.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Booked {formatDateTime(booking.created_at)}</span>
                      </div>
                    </div>

                    {/* Card Main Content */}
                    <div className="p-6">
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{booking.city}</span>
                          </div>
                          <h3 className="mt-1 text-lg font-bold text-slate-900">
                            {booking.lot_name}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-800">
                              Bay {booking.slot_number}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 font-mono font-bold text-blue-800">
                              <Car className="h-3.5 w-3.5" />
                              {booking.vehicle_number}
                            </span>
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDateTime(booking.start_time)} →{" "}
                              {formatDateTime(booking.end_time)} (
                              {booking.duration_hours}h)
                            </span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 text-right sm:min-w-[180px]">
                          <p className="text-[11px] font-medium text-slate-500">
                            Total Settled (Incl. 18% GST)
                          </p>
                          <p className="mt-0.5 text-xl font-bold text-slate-900">
                            {formatINR(booking.total_amount_inr)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Base {formatINR(booking.base_amount_inr)} + GST{" "}
                            {formatINR(booking.gst_amount_inr)}
                          </p>
                        </div>
                      </div>

                      {/* Cryptographic & Payment Metadata */}
                      <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-600 sm:grid-cols-3">
                        <div>
                          <span className="text-slate-400">Razorpay Order:</span>{" "}
                          <span className="font-mono font-semibold text-slate-800">
                            {booking.payment.razorpay_order_id}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Payment Mode:</span>{" "}
                          <span className="font-semibold text-slate-800">
                            {booking.payment.payment_method}
                          </span>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-400">HMAC Token:</span>{" "}
                          <span className="font-mono font-semibold text-blue-700">
                            {booking.qr_signature.slice(0, 16)}...
                          </span>
                        </div>
                      </div>

                      {/* Action Controls */}
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedQrBooking(booking)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            View QR Pass &amp; GST Receipt
                          </button>

                          {canExtend && (
                            <div className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50/60 p-1">
                              <span className="px-2 text-[11px] font-semibold text-blue-800">
                                Extend:
                              </span>
                              {[1, 2, 4].map((hrs) => (
                                <button
                                  key={hrs}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleExtend(booking.booking_reference, hrs)
                                  }
                                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-blue-700 shadow-xs transition hover:bg-blue-600 hover:text-white disabled:opacity-50"
                                >
                                  +{hrs}h
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {canCancel && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleCancel(booking.booking_reference)
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancel &amp; Refund
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right 4 Cols: Notifications & GST Tax Receipt Ledger */}
          <div className="space-y-6 lg:col-span-4">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Notifications &amp; Receipts
                  </h2>
                </div>
                {stats.unreadNotifs > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="mt-4 max-h-[540px] space-y-3 overflow-y-auto pr-1">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`rounded-2xl border p-3.5 transition ${
                      notif.read
                        ? "border-slate-200/70 bg-slate-50/50"
                        : "border-blue-200 bg-blue-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          notif.category === "BOOKING"
                            ? "bg-blue-100 text-blue-700"
                            : notif.category === "EXTENSION"
                              ? "bg-indigo-100 text-indigo-700"
                              : notif.category === "CANCELLATION"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {notif.category}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(notif.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-bold text-slate-900">
                      {notif.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {notif.message}
                    </p>
                    {notif.bookingReference && (
                      <button
                        type="button"
                        onClick={() => {
                          const found = bookings.find(
                            (b) =>
                              b.booking_reference === notif.bookingReference
                          );
                          if (found) setSelectedQrBooking(found);
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        Open Receipt ({notif.bookingReference})
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* GST Compliance Note */}
            <div className="rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50/80 via-white to-slate-50 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
                <ShieldCheck className="h-4 w-4" />
                <span>Enterprise Tax &amp; Refund SLA</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                All Parkwise reservations include an automated 18% GST breakup
                (9% CGST + 9% SGST) under SAC 996743. Cancellations prior to
                check-in trigger an immediate 100% Razorpay refund and release
                the IoT bay lock within 150ms.
              </p>
              <Link
                href="/driver/profile"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Configure Corporate GSTIN in Profile →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* QR Pass & GST Receipt Modal */}
      {selectedQrBooking && (
        <QrPassModal
          booking={selectedQrBooking}
          onClose={() => setSelectedQrBooking(null)}
        />
      )}
    </div>
  );
}
