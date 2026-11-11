"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  BatteryCharging,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Languages,
  MapPin,
  MessageSquare,
  Navigation,
  Send,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { BookingAssistantResponse, RankedSlotCandidateItem, VehicleSize } from "@/types";

interface AIBookingAssistantProps {
  onApplySlot?: (selection: {
    lotId: number;
    slotId?: number;
    vehicleSize?: VehicleSize;
    requiresEv?: boolean;
    requiresAccessible?: boolean;
    durationHours?: number;
    arrivalDateTime?: string;
  }) => void;
}

const SAMPLE_QUERIES = [
  {
    lang: "EN",
    label: "Cyber City EV",
    text: "Need EV parking near Cyber City tomorrow for 3 hours",
  },
  {
    lang: "HI",
    label: "साइबर हब ईवी",
    text: "मुझे कल साइबर हब में 2 घंटे के लिए ईवी स्लॉट चाहिए",
  },
  {
    lang: "EN",
    label: "Connaught Place SUV",
    text: "Need SUV parking in Connaught Place for 4 hours",
  },
  {
    lang: "HI",
    label: "मुंबई बीकेसी",
    text: "मुंबई बीकेसी में 3 घंटे के लिए सेडान पार्किंग चाहिए",
  },
  {
    lang: "EN",
    label: "Accessible BKC",
    text: "Accessible ground-floor parking near BKC Mumbai for 2 hours",
  },
];

export function AIBookingAssistant({ onApplySlot }: AIBookingAssistantProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] =
    useState<BookingAssistantResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<
    {
      sender: "user" | "assistant";
      text: string;
      response?: BookingAssistantResponse;
      timestamp: string;
    }[]
  >([]);

  async function handleSendQuery(userText?: string) {
    const textToSend = (userText || query).trim();
    if (!textToSend) return;

    setError(null);
    setLoading(true);

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setChatHistory((prev) => [
      ...prev,
      { sender: "user", text: textToSend, timestamp: now },
    ]);
    if (!userText) setQuery("");

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/v1/ai/booking-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          query: textToSend,
          preferred_language: "AUTO",
          user_id: "USR-DRIVER-MOBILE",
        }),
      });

      if (!res.ok) {
        throw new Error(`AI assistant error: HTTP ${res.status}`);
      }

      const data: BookingAssistantResponse = await res.json();
      setLastResponse(data);

      setChatHistory((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: data.reply || data.reply_en || data.message,
          response: data,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reach booking assistant";
      setError(msg);
      setChatHistory((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: `Error connecting to Parkwise AI: ${msg}. Please ensure backend is running.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectOption(slot: RankedSlotCandidateItem) {
    if (!onApplySlot) return;

    const params = lastResponse?.search_params;
    let size: VehicleSize | undefined = undefined;
    if (params?.vehicle_size === "SUV_XL" || params?.vehicle_size === "COMPACT" || params?.vehicle_size === "SEDAN") {
      size = params.vehicle_size as VehicleSize;
    }

    onApplySlot({
      lotId: slot.lot_id,
      slotId: slot.slot_id,
      vehicleSize: size,
      requiresEv: slot.slot_type === "EV_CHARGING" || params?.requires_ev,
      requiresAccessible: slot.slot_type === "ACCESSIBLE" || params?.requires_accessible,
      durationHours: params?.duration_hours || 2,
      arrivalDateTime: params?.start_time ? params.start_time.slice(0, 16) : undefined,
    });
  }

  return (
    <div className="rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50/60 via-white to-emerald-50/40 p-5 shadow-apple space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-brand-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-700">
                Phase 07 • Module 4
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <Languages className="h-3 w-3" />
                English &amp; हिंदी
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Parkwise Conversational Booking Assistant
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-brand-300 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-sm hover:bg-brand-50 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-brand-600" />
          <span>{isOpen ? "Hide Assistant" : "Open Assistant Chat"}</span>
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform ${
              isOpen ? "rotate-90" : ""
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-slate-600">
        Search for parking using natural language in English, Hindi (Devanagari), or Hinglish.
        The AI validates live database availability before generating a conflict-free draft.
      </p>

      {/* Quick Prompts Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-slate-500">
          Try saying:
        </span>
        {SAMPLE_QUERIES.map((sq, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setQuery(sq.text);
              handleSendQuery(sq.text);
              if (!isOpen) setIsOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50 transition-all shadow-2xs"
          >
            <span
              className={`rounded-sm px-1 py-0.2 text-[9px] font-black ${
                sq.lang === "HI"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {sq.lang}
            </span>
            <span className="max-w-[190px] truncate">{sq.label}</span>
          </button>
        ))}
      </div>

      {/* Collapsible Chat Body */}
      {isOpen && (
        <div className="space-y-4 pt-2">
          {/* Chat Messages */}
          <div className="max-h-[380px] overflow-y-auto space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            {chatHistory.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Sparkles className="mx-auto h-7 w-7 text-brand-500 animate-pulse" />
                <p className="text-xs font-bold text-slate-700">
                  Ask anything in English or Hindi
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  e.g., &quot;Need EV parking near Cyber City tomorrow for 3 hours&quot; or &quot;मुझे कल साइबर हब में 2 घंटे के लिए ईवी स्लॉट चाहिए&quot;
                </p>
              </div>
            ) : (
              chatHistory.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    item.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                      item.sender === "user"
                        ? "bg-brand-600 text-white font-medium"
                        : "bg-white text-slate-800 border border-slate-200 shadow-2xs space-y-2"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 text-[10px] text-slate-400">
                      <span className="font-bold">
                        {item.sender === "user" ? "You" : "Parkwise AI Assistant"}
                      </span>
                      <span>{item.timestamp}</span>
                    </div>

                    <p className="whitespace-pre-wrap leading-relaxed">
                      {item.text}
                    </p>

                    {item.response && (
                      <div className="space-y-2.5 pt-2">
                        {/* Extracted Entities Chips */}
                        {item.response.extracted_entities && (
                          <div className="rounded-xl bg-slate-50 p-2 space-y-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              Parsed Entities ({item.response.detected_language})
                            </span>
                            <div className="flex flex-wrap gap-1.5 text-[10px]">
                              {Object.entries(item.response.extracted_entities)
                                .filter(([, val]) => val !== null && val !== undefined)
                                .map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 font-medium text-slate-700"
                                  >
                                    <strong className="text-slate-500">{k}:</strong>{" "}
                                    {String(v)}
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Validated Slot Recommendations */}
                        {item.response.validated_options &&
                          item.response.validated_options.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] font-bold text-slate-700">
                                Validated Database Matches ({item.response.validated_options.length})
                              </span>
                              <div className="space-y-1.5">
                                {item.response.validated_options.map((opt) => (
                                  <div
                                    key={opt.slot_id}
                                    className="flex items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-2 text-xs"
                                  >
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-black text-brand-700">
                                          Bay {opt.slot_number}
                                        </span>
                                        <span className="text-slate-500">•</span>
                                        <span className="text-[11px] font-bold text-slate-800">
                                          {opt.lot_name}
                                        </span>
                                        {opt.slot_type === "EV_CHARGING" && (
                                          <span className="rounded bg-emerald-100 px-1 text-[9px] font-extrabold text-emerald-800">
                                            EV 50kW
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                        <span>Floor {opt.floor}</span>
                                        <span>•</span>
                                        <span>{Math.round(opt.distance_km * 1000)}m to gate</span>
                                        <span>•</span>
                                        <span className="font-mono font-bold text-slate-800">
                                          ₹{opt.estimated_total_inr}
                                        </span>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleSelectOption(opt)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-brand-700 shadow-2xs"
                                    >
                                      <span>Select Bay</span>
                                      <ChevronRight className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Guardrail Banner */}
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Zero direct mutations. Driver must review &amp; confirm booking checkout.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 p-3 text-xs text-slate-600 shadow-2xs">
                <Sparkles className="h-4 w-4 text-brand-600 animate-spin" />
                <span>Parkwise AI is parsing query and checking DB availability...</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  e.preventDefault();
                  handleSendQuery();
                }
              }}
              placeholder="e.g. Need EV parking near Cyber City tomorrow for 3 hours (English or हिंदी)..."
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-brand-600 focus:outline-none shadow-2xs"
            />
            <button
              type="button"
              disabled={loading || !query.trim()}
              onClick={() => handleSendQuery()}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              <span>Ask AI</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
