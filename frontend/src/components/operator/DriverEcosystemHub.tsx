"use client";

import React, { useState, useEffect } from "react";
import {
  Car,
  Compass,
  MapPin,
  KeyRound,
  ShoppingBag,
  LifeBuoy,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Camera,
  RefreshCw,
  PlusCircle,
  ArrowRight,
  Footprints,
  PhoneCall,
  UserCheck,
  Film,
  UtensilsCrossed,
  Smartphone,
  Building,
  Check,
  XCircle,
  AlertCircle,
  FileText,
  Lock,
} from "lucide-react";
import {
  driverConvenienceApi,
  SavedVehicleLocationResponse,
  PedestrianRouteResponse,
  ValetBookingResponse,
  VenueDestinationResponse,
  AssistanceRequestResponse,
} from "@/lib/driverConvenienceApi";

type Phase19Tab = "FIND_MY_CAR" | "VALET" | "VENUES" | "ASSISTANCE";

export function DriverEcosystemHub() {
  const [activeTab, setActiveTab] = useState<Phase19Tab>("FIND_MY_CAR");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Pillar A: Find My Car
  const [savedLoc, setSavedLoc] = useState<SavedVehicleLocationResponse | null>(null);
  const [pedestrianRoute, setPedestrianRoute] = useState<PedestrianRouteResponse | null>(null);
  const [isEditingLoc, setIsEditingLoc] = useState<boolean>(false);
  const [editFloor, setEditFloor] = useState<string>("B2");
  const [editZone, setEditZone] = useState<string>("Zone Green");
  const [editSlot, setEditSlot] = useState<string>("B2-142");
  const [editPillar, setEditPillar] = useState<string>("Pillar 4B");
  const [editNotes, setEditNotes] = useState<string>("Directly opposite elevator lobby glass doors.");

  // Pillar B: Valet
  const [valetList, setValetList] = useState<ValetBookingResponse[]>([]);
  const [selectedValet, setSelectedValet] = useState<ValetBookingResponse | null>(null);
  const [isRequestingValet, setIsRequestingValet] = useState<boolean>(false);
  const [valetPlate, setValetPlate] = useState<string>("DL01EV9922");
  const [valetModel, setValetModel] = useState<string>("Porsche Taycan 4S");
  const [valetDriver, setValetDriver] = useState<string>("Karan Malhotra");
  const [valetPhone, setValetPhone] = useState<string>("+91 98111 88888");
  const [returnOtpInput, setReturnOtpInput] = useState<string>("");
  const [inspectionNotesInput, setInspectionNotesInput] = useState<string>("Clean exterior, 80% SoC.");
  const [storageSlotInput, setStorageSlotInput] = useState<string>("Valet Vault V-08");

  // Pillar C: Mall Venues
  const [venues, setVenues] = useState<VenueDestinationResponse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedVenue, setSelectedVenue] = useState<VenueDestinationResponse | null>(null);
  const [venueRoute, setVenueRoute] = useState<PedestrianRouteResponse | null>(null);
  const [routeDirection, setRouteDirection] = useState<"CAR_TO_VENUE" | "VENUE_TO_CAR">("CAR_TO_VENUE");

  // Pillar D: Assistance & Support
  const [assistanceTickets, setAssistanceTickets] = useState<AssistanceRequestResponse[]>([]);
  const [isLodgingTicket, setIsLodgingTicket] = useState<boolean>(false);
  const [ticketCategory, setTicketCategory] = useState<string>("BLOCKED_SLOT");
  const [ticketUrgency, setTicketUrgency] = useState<string>("HIGH");
  const [ticketDesc, setTicketDesc] = useState<string>("Delivery cart parked across designated bay B2-142.");
  const [ticketSlot, setTicketSlot] = useState<string>("B2-142");

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Initial Data Load
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Find My Car
      const loc = await driverConvenienceApi.getLocation(1);
      setSavedLoc(loc);
      if (loc) {
        try {
          const route = await driverConvenienceApi.getReturnRoute(1);
          setPedestrianRoute(route);
        } catch {
          // silent
        }
      }

      // 2. Valet
      const valets = await driverConvenienceApi.listValetRequests();
      setValetList(valets);
      if (valets.length > 0 && !selectedValet) {
        setSelectedValet(valets[0]);
      }

      // 3. Venues
      const vList = await driverConvenienceApi.listVenues();
      setVenues(vList);
      if (vList.length > 0 && !selectedVenue) {
        setSelectedVenue(vList[0]);
      }

      // 4. Assistance
      const tickets = await driverConvenienceApi.listAssistanceRequests();
      setAssistanceTickets(tickets);
    } catch (err: any) {
      console.error("Failed to load Phase 19 data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // ---------------------------------------------------------------------------
  // Action Handlers: Find My Car
  // ---------------------------------------------------------------------------
  const handleSaveLocation = async () => {
    try {
      setIsLoading(true);
      const res = await driverConvenienceApi.saveLocation({
        facility_id: 1,
        floor: editFloor,
        zone: editZone,
        slot_number: editSlot,
        pillar_reference: editPillar,
        driver_notes: editNotes,
        photo_url: "/static/sample_parked_car.jpg",
      });
      setSavedLoc(res);
      setNotification({
        type: "success",
        message: `Vehicle location saved: Bay ${res.slot_number} (${res.floor}, ${res.zone}). 24h retention active.`,
      });
      setIsEditingLoc(false);

      // Compute route
      const route = await driverConvenienceApi.getReturnRoute(1);
      setPedestrianRoute(route);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to save location." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLocation = async () => {
    try {
      setIsLoading(true);
      await driverConvenienceApi.clearLocation(1);
      setSavedLoc(null);
      setPedestrianRoute(null);
      setNotification({
        type: "info",
        message: "Saved vehicle location cleared under privacy data retention policy.",
      });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to clear location." });
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action Handlers: Valet Parking
  // ---------------------------------------------------------------------------
  const handleRequestValet = async () => {
    try {
      setIsLoading(true);
      const res = await driverConvenienceApi.requestValet({
        facility_id: 1,
        vehicle_plate: valetPlate,
        vehicle_model: valetModel,
        driver_name: valetDriver,
        driver_phone: valetPhone,
        pre_inspection_notes: "VIP Drop-off at Grand Portico.",
      });
      setValetList((prev) => [res, ...prev]);
      setSelectedValet(res);
      setNotification({
        type: "success",
        message: `Valet requested! Digital Ticket: ${res.valet_ticket_number}. Return OTP: ${res.handover_otp}.`,
      });
      setIsRequestingValet(false);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to request valet." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleHandoverValet = async () => {
    if (!selectedValet) return;
    try {
      setIsLoading(true);
      const res = await driverConvenienceApi.valetHandover({
        valet_ticket_number: selectedValet.valet_ticket_number,
        attendant_name: "Attendant Vikram Singh",
        inspection_notes: inspectionNotesInput,
        fuel_level_percent: 75,
        odometer_km: 12500,
      });
      setSelectedValet(res);
      setNotification({
        type: "success",
        message: `Attendant Handover Accepted! Vehicle logged into custody.`,
      });
      const list = await driverConvenienceApi.listValetRequests();
      setValetList(list);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Handover failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleParkValet = async () => {
    if (!selectedValet) return;
    try {
      setIsLoading(true);
      const res = await driverConvenienceApi.valetPark({
        valet_ticket_number: selectedValet.valet_ticket_number,
        storage_slot: storageSlotInput,
        attendant_name: "Attendant Vikram Singh",
      });
      setSelectedValet(res);
      setNotification({
        type: "success",
        message: `Vehicle parked in ${res.assigned_storage_slot}. Custody status updated.`,
      });
      const list = await driverConvenienceApi.listValetRequests();
      setValetList(list);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Parking failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetrieveValet = async () => {
    if (!selectedValet) return;
    try {
      setIsLoading(true);
      const res = await driverConvenienceApi.valetRetrieve(selectedValet.valet_ticket_number);
      setSelectedValet(res);
      setNotification({
        type: "info",
        message: `Retrieval requested! Valet runner summoned to bring vehicle to exit portico.`,
      });
      const list = await driverConvenienceApi.listValetRequests();
      setValetList(list);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Retrieval request failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyReturnValet = async () => {
    if (!selectedValet) return;
    try {
      setIsLoading(true);
      const res = await driverConvenienceApi.valetVerifyReturn({
        valet_ticket_number: selectedValet.valet_ticket_number,
        handover_otp: returnOtpInput,
        attendant_name: "Attendant Vikram Singh",
      });
      setSelectedValet(res);
      setNotification({
        type: "success",
        message: `Driver OTP Verified! Custody released back to ${res.driver_name}. Valet completed.`,
      });
      setReturnOtpInput("");
      const list = await driverConvenienceApi.listValetRequests();
      setValetList(list);
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Security Verification Failed: Invalid 6-digit driver return OTP.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action Handlers: Mall Venues
  // ---------------------------------------------------------------------------
  const handleSelectVenue = async (venue: VenueDestinationResponse, reverse = false) => {
    setSelectedVenue(venue);
    setRouteDirection(reverse ? "VENUE_TO_CAR" : "CAR_TO_VENUE");
    try {
      setIsLoading(true);
      const route = await driverConvenienceApi.getVenueRoute(venue.id, 1, reverse);
      setVenueRoute(route);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to calculate venue route." });
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action Handlers: Driver Assistance
  // ---------------------------------------------------------------------------
  const handleLodgeTicket = async () => {
    try {
      setIsLoading(true);
      const res = await driverConvenienceApi.createAssistanceRequest({
        facility_id: 1,
        driver_name: "Ananya Roy",
        driver_phone: "+91 98220 12345",
        vehicle_plate: "DL03AB4021",
        slot_number: ticketSlot,
        category: ticketCategory,
        urgency: ticketUrgency,
        description: ticketDesc,
      });
      setAssistanceTickets((prev) => [res, ...prev]);
      setNotification({
        type: "success",
        message: `Support Ticket ${res.ticket_number} lodged! Parking staff dispatched.`,
      });
      setIsLodgingTicket(false);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to lodge ticket." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketNumber: string, nextStatus: string) => {
    try {
      setIsLoading(true);
      const res = await driverConvenienceApi.updateAssistanceStatus({
        ticket_number: ticketNumber,
        status: nextStatus,
        staff_name: "Duty Officer Suraj Patil",
        notes: `Action taken: status updated to ${nextStatus}. Obstruction cleared and verified.`,
      });
      setNotification({
        type: "success",
        message: `Ticket ${res.ticket_number} transitioned to ${res.status}!`,
      });
      const list = await driverConvenienceApi.listAssistanceRequests();
      setAssistanceTickets(list);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to update ticket." });
    } finally {
      setIsLoading(false);
    }
  };

  // Category Filtered Venues
  const filteredVenues =
    selectedCategory === "ALL"
      ? venues
      : venues.filter((v) => v.category === selectedCategory);

  return (
    <div className="w-full bg-[#060a14] text-slate-100 min-h-screen p-6 md:p-8 space-y-8 font-sans">
      {/* ========================================================================= */}
      {/* 1. Header */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Phase 19 Operational Suite
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Driver Convenience & Venue Ecosystem
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Driver Convenience, Valet & Venue Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            End-to-end journey ecosystem: Find My Car pedestrian return, full-custody VIP Valet operations, multi-floor
            mall venue routing, and live driver incident assistance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
            Refresh Hub
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between transition-all duration-300 shadow-xl ${
            notification.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
              : notification.type === "error"
              ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
              : "bg-cyan-950/40 border-cyan-500/40 text-cyan-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {notification.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            {notification.type === "info" && <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-70 hover:opacity-100 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Key Metrics Strip */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Saved Parking</span>
            <MapPin className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{savedLoc ? savedLoc.slot_number : "None"}</span>
            <span className="text-xs text-cyan-400 font-medium">({savedLoc ? savedLoc.floor : "Unsaved"})</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">24-hour privacy retention active</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Valet Custody</span>
            <KeyRound className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{valetList.length}</span>
            <span className="text-xs text-amber-400 font-medium">Active Tickets</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">6-digit return OTP guardrail</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mall Venues</span>
            <ShoppingBag className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{venues.length}</span>
            <span className="text-xs text-purple-400 font-medium">Stores & Cinemas</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Multi-floor pedestrian routing</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Support Desk</span>
            <LifeBuoy className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              {assistanceTickets.filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED").length}
            </span>
            <span className="text-xs text-rose-400 font-medium">Open Incidents</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">24/7 Security & Patrol Dispatch</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Pillar Navigation Tabs */}
      {/* ========================================================================= */}
      <div className="flex items-center border-b border-slate-800 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("FIND_MY_CAR")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "FIND_MY_CAR"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Compass className="w-4 h-4" />
          Find My Car & Pedestrian Navigation
        </button>

        <button
          onClick={() => setActiveTab("VALET")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "VALET"
              ? "border-amber-500 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Valet Operations & Custody
        </button>

        <button
          onClick={() => setActiveTab("VENUES")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "VENUES"
              ? "border-purple-500 text-purple-400 bg-purple-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Mall & Venue Integration
        </button>

        <button
          onClick={() => setActiveTab("ASSISTANCE")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "ASSISTANCE"
              ? "border-rose-500 text-rose-400 bg-rose-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          Driver Assistance & Incident Desk
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1: FIND MY CAR & PEDESTRIAN ROUTING */}
      {/* ========================================================================= */}
      {activeTab === "FIND_MY_CAR" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Parked Car Badge & Edit */}
          <div className="space-y-6">
            {savedLoc ? (
              <div className="p-6 rounded-3xl bg-slate-900 border border-cyan-500/30 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-cyan-400 font-bold">Active Saved Location</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Live
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                    <Car className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Bay {savedLoc.slot_number}</h2>
                    <div className="text-xs text-cyan-400 font-semibold">
                      {savedLoc.floor} • {savedLoc.zone}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {savedLoc.pillar_reference || "No pillar reference"}
                    </div>
                  </div>
                </div>

                {savedLoc.driver_notes && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 italic">
                    "{savedLoc.driver_notes}"
                  </div>
                )}

                <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800">
                  <span>Facility: {savedLoc.facility_name}</span>
                  <button
                    onClick={handleClearLocation}
                    disabled={isLoading}
                    className="text-rose-400 hover:text-rose-300 hover:underline font-semibold"
                  >
                    Clear Location
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3 shadow-xl">
                <Car className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-white">No Vehicle Location Saved</h3>
                <p className="text-xs text-slate-400">
                  Save your parked spot manually or link your active parking booking.
                </p>
                <button
                  onClick={() => setIsEditingLoc(true)}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition shadow"
                >
                  Save My Parking Spot
                </button>
              </div>
            )}

            {/* Manual Save Form Drawer */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                Manual Location & Photo Notes
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 font-medium">Floor</label>
                  <input
                    type="text"
                    value={editFloor}
                    onChange={(e) => setEditFloor(e.target.value.toUpperCase())}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Zone</label>
                  <input
                    type="text"
                    value={editZone}
                    onChange={(e) => setEditZone(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Bay Number</label>
                  <input
                    type="text"
                    value={editSlot}
                    onChange={(e) => setEditSlot(e.target.value.toUpperCase())}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Pillar Landmark</label>
                  <input
                    type="text"
                    value={editPillar}
                    onChange={(e) => setEditPillar(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Driver Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <button
                onClick={handleSaveLocation}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition shadow flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save Parking Location
              </button>
            </div>
          </div>

          {/* Right Column: Pedestrian Return Navigation */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Footprints className="w-5 h-5 text-cyan-400" />
                  Turn-by-Turn Pedestrian Return Route
                </h2>
                <p className="text-xs text-slate-400">
                  Strictly utilizes elevators, escalators, and illuminated pedestrian concourses (no vehicle lanes).
                </p>
              </div>

              {pedestrianRoute && (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold">
                    {pedestrianRoute.total_distance_meters}m (~{pedestrianRoute.estimated_walk_minutes} min walk)
                  </span>
                </div>
              )}
            </div>

            {pedestrianRoute ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-slate-400">Origin:</span>{" "}
                    <span className="text-white font-semibold">{pedestrianRoute.origin}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-slate-400">Destination:</span>{" "}
                    <span className="text-cyan-400 font-bold">{pedestrianRoute.destination}</span>
                  </div>
                </div>

                {/* Waypoints Timeline */}
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800">
                  {pedestrianRoute.steps.map((st) => (
                    <div key={st.step_number} className="relative flex items-start gap-4 pl-8">
                      <div
                        className={`absolute left-1.5 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-slate-950 ${
                          st.step_type === "ELEVATOR"
                            ? "border-cyan-400"
                            : st.step_type === "ARRIVED"
                            ? "border-emerald-400"
                            : "border-slate-600"
                        }`}
                      />
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex-1 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">
                            Step {st.step_number}: {st.instruction}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">{st.distance_meters}m</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                            {st.floor}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] font-mono text-cyan-400">
                            {st.step_type}
                          </span>
                          {st.notes && <span className="text-slate-500 italic">({st.notes})</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">
                Save vehicle location on the left to generate your pedestrian return route.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2: VALET OPERATIONS & CUSTODY */}
      {/* ========================================================================= */}
      {activeTab === "VALET" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Valet Tickets Queue */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                Active Valet Parking Tickets
              </h2>
              <button
                onClick={() => setIsRequestingValet(!isRequestingValet)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                New Valet Request
              </button>
            </div>

            {/* Request Drawer */}
            {isRequestingValet && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-4 shadow-xl">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Initiate VIP Valet Service
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400">Vehicle Plate</label>
                    <input
                      type="text"
                      value={valetPlate}
                      onChange={(e) => setValetPlate(e.target.value.toUpperCase())}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">Model</label>
                    <input
                      type="text"
                      value={valetModel}
                      onChange={(e) => setValetModel(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">Driver Name</label>
                    <input
                      type="text"
                      value={valetDriver}
                      onChange={(e) => setValetDriver(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">Driver Phone</label>
                    <input
                      type="text"
                      value={valetPhone}
                      onChange={(e) => setValetPhone(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                </div>
                <button
                  onClick={handleRequestValet}
                  disabled={isLoading}
                  className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition shadow"
                >
                  Confirm Valet Intake Request
                </button>
              </div>
            )}

            {/* Tickets Table */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-2">Ticket #</th>
                      <th className="pb-2">Vehicle</th>
                      <th className="pb-2">Driver</th>
                      <th className="pb-2">Attendant</th>
                      <th className="pb-2">Vault Slot</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {valetList.map((v) => {
                      const isSelected = selectedValet?.id === v.id;
                      return (
                        <tr
                          key={v.id}
                          onClick={() => setSelectedValet(v)}
                          className={`cursor-pointer transition ${
                            isSelected ? "bg-amber-500/10 text-white" : "text-slate-200 hover:bg-slate-800/50"
                          }`}
                        >
                          <td className="py-3 font-bold text-amber-400">{v.valet_ticket_number}</td>
                          <td className="py-3 font-sans">
                            <div className="font-bold text-white font-mono">{v.vehicle_plate}</div>
                            <div className="text-[10px] text-slate-400">{v.vehicle_model}</div>
                          </td>
                          <td className="py-3 font-sans">{v.driver_name}</td>
                          <td className="py-3 font-sans text-slate-300">{v.assigned_attendant_name || "—"}</td>
                          <td className="py-3 text-cyan-400">{v.assigned_storage_slot || "Pending"}</td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                v.status === "RETURNED_TO_DRIVER"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : v.status === "PARKED_IN_STORAGE"
                                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                  : v.status === "RETRIEVAL_REQUESTED"
                                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 animate-pulse"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {v.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Custody & Return Verification Panel */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 flex flex-col justify-between shadow-xl">
            {selectedValet ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Custody & Verification Desk
                  </h3>
                  <span className="text-[11px] font-mono text-amber-400 font-bold">
                    {selectedValet.valet_ticket_number}
                  </span>
                </div>

                {/* Return OTP Display & Guardrail Note */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Driver Return OTP PIN:</span>
                    <span className="text-lg font-black text-amber-400 font-mono tracking-widest">
                      {selectedValet.handover_otp}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Guardrail: Attendant must enter this exact 6-digit PIN before releasing vehicle keys back to driver.
                  </p>
                </div>

                {/* Operations Actions based on Status */}
                <div className="space-y-3 pt-2">
                  {selectedValet.status === "REQUESTED" && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={inspectionNotesInput}
                        onChange={(e) => setInspectionNotesInput(e.target.value)}
                        placeholder="Intake Inspection Notes"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                      <button
                        onClick={handleHandoverValet}
                        disabled={isLoading}
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition shadow"
                      >
                        Accept Custody & Handover
                      </button>
                    </div>
                  )}

                  {selectedValet.status === "ACCEPTED_BY_VALET" && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={storageSlotInput}
                        onChange={(e) => setStorageSlotInput(e.target.value)}
                        placeholder="Assign Vault Slot (e.g. Valet Vault V-04)"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                      <button
                        onClick={handleParkValet}
                        disabled={isLoading}
                        className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition shadow"
                      >
                        Record Parked in Storage
                      </button>
                    </div>
                  )}

                  {selectedValet.status === "PARKED_IN_STORAGE" && (
                    <button
                      onClick={handleRetrieveValet}
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition shadow"
                    >
                      Driver Requests Vehicle Retrieval
                    </button>
                  )}

                  {(selectedValet.status === "RETRIEVAL_REQUESTED" || selectedValet.status === "PARKED_IN_STORAGE") && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <label className="text-xs text-slate-400 font-medium">Verify Driver 6-Digit OTP:</label>
                      <input
                        type="text"
                        value={returnOtpInput}
                        onChange={(e) => setReturnOtpInput(e.target.value.trim())}
                        placeholder="Enter 6-digit OTP"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white tracking-widest text-center"
                      />
                      <button
                        onClick={handleVerifyReturnValet}
                        disabled={isLoading || returnOtpInput.length !== 6}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white transition shadow"
                      >
                        Verify OTP & Release Vehicle
                      </button>
                    </div>
                  )}

                  {selectedValet.status === "RETURNED_TO_DRIVER" && (
                    <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 font-semibold text-center">
                      Vehicle returned to driver. Custody complete.
                    </div>
                  )}
                </div>

                {/* Custody Logs Timeline */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Timestamped Custody History
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto text-[11px] font-mono text-slate-300">
                    {selectedValet.custody_logs.map((log, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className="text-amber-400 font-bold">{log.action}</span>
                        </div>
                        <div>
                          {log.actor} ({log.role}): {log.notes}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">
                Select a valet ticket on the left to manage vehicle custody.
              </div>
            )}

            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-[11px] text-amber-300">
              <span className="font-bold">Security Verification Guardrail:</span> Vehicle handover cannot be completed
              without validating the driver's cryptographic 6-digit return OTP.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 3: MALL VENUES & MULTI-FLOOR NAVIGATION */}
      {/* ========================================================================= */}
      {activeTab === "VENUES" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Venue Directory */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-purple-400" />
                  Facility Stores & Attractions Directory
                </h2>
                <p className="text-xs text-slate-400">
                  Select a store to calculate multi-floor pedestrian directions from your parked car or back to it.
                </p>
              </div>

              {/* Category Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {["ALL", "SHOPPING", "DINING", "CINEMA", "OFFICES"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                      selectedCategory === cat
                        ? "bg-purple-600 text-white shadow"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid of Stores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredVenues.map((v) => {
                const isSelected = selectedVenue?.id === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVenue(v, false)}
                    className={`p-5 rounded-2xl cursor-pointer transition border relative space-y-3 ${
                      isSelected
                        ? "bg-slate-900 border-purple-500 shadow-lg shadow-purple-500/10"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-white">{v.name}</div>
                        <div className="text-xs text-purple-400 font-medium">
                          {v.floor} • {v.unit_number}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {v.category}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 line-clamp-2">{v.description}</div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Nearest: {v.nearest_elevator_bank}</span>
                      <span className="text-slate-300 font-mono">{v.opening_hours}</span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectVenue(v, false);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-[11px] font-semibold text-white transition text-center"
                      >
                        Car → Store
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectVenue(v, true);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-purple-300 transition text-center"
                      >
                        Store → Car
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Multi-Floor Route Waypoints */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Footprints className="w-4 h-4 text-purple-400" />
                Pedestrian Path Visualizer
              </h3>
              <span className="text-[10px] font-mono text-purple-400 font-bold">
                {routeDirection === "CAR_TO_VENUE" ? "Car → Store" : "Store → Car"}
              </span>
            </div>

            {venueRoute && selectedVenue ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                  <div className="text-slate-400">
                    Route: <span className="text-white font-bold">{venueRoute.origin}</span> →{" "}
                    <span className="text-purple-400 font-bold">{venueRoute.destination}</span>
                  </div>
                  <div className="text-purple-300">
                    Total Walk: {venueRoute.total_distance_meters}m (~{venueRoute.estimated_walk_minutes} mins)
                  </div>
                </div>

                {/* Waypoints */}
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800">
                  {venueRoute.steps.map((st) => (
                    <div key={st.step_number} className="relative flex items-start gap-4 pl-8">
                      <div
                        className={`absolute left-1.5 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-slate-950 ${
                          st.step_type === "ELEVATOR"
                            ? "border-purple-400"
                            : st.step_type === "ARRIVED"
                            ? "border-emerald-400"
                            : "border-slate-600"
                        }`}
                      />
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex-1 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">
                            Step {st.step_number}: {st.instruction}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">{st.distance_meters}m</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                            {st.floor}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] font-mono text-purple-400">
                            {st.step_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">
                Select a venue on the left to compute pedestrian route.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TAB 4: DRIVER ASSISTANCE & SUPPORT CENTER */}
      {/* ========================================================================= */}
      {activeTab === "ASSISTANCE" && (
        <div className="space-y-6">
          {/* Facility Emergency SOS Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <LifeBuoy className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">24/7 Facility Support & Emergency Assistance</h3>
                <p className="text-xs text-slate-400">
                  Duty Manager Hotline: +91 11 4000 9999 • On-Site Security SOS Patrol: Channel 4
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsLodgingTicket(!isLodgingTicket)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition shadow flex items-center gap-2 self-start"
            >
              <PlusCircle className="w-4 h-4" />
              Report Incident / Request Help
            </button>
          </div>

          {/* Ticket Lodge Drawer */}
          {isLodgingTicket && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-rose-500/40 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <LifeBuoy className="w-4 h-4" />
                Lodge Incident or Assistance Ticket
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400">Category</label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="BLOCKED_SLOT">Blocked Slot (Unauthorized Car)</option>
                    <option value="DAMAGED_EQUIPMENT">Damaged Equipment / Broken EV Charger</option>
                    <option value="NAVIGATION_ISSUE">Navigation / Lost in Garage</option>
                    <option value="PAYMENT_DISPUTE">Payment / Exit Barrier Dispute</option>
                    <option value="EMERGENCY_SOS">Emergency SOS (Security Needed)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400">Urgency</label>
                  <select
                    value={ticketUrgency}
                    onChange={(e) => setTicketUrgency(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="LOW">Low (General Query)</option>
                    <option value="MEDIUM">Medium (Minor Delay)</option>
                    <option value="HIGH">High (Blocked Bay / Vehicle)</option>
                    <option value="CRITICAL_SOS">Critical (Emergency SOS)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400">Affected Slot / Location</label>
                  <input
                    type="text"
                    value={ticketSlot}
                    onChange={(e) => setTicketSlot(e.target.value.toUpperCase())}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Description of Incident</label>
                <textarea
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <button
                onClick={handleLodgeTicket}
                disabled={isLoading}
                className="py-2.5 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition shadow"
              >
                Dispatch Support Request
              </button>
            </div>
          )}

          {/* Incident Tickets Queue */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white">Live Incident & Support Tickets</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-2">Ticket #</th>
                    <th className="pb-2">Driver</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Urgency</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Assigned Staff</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {assistanceTickets.map((t) => (
                    <tr key={t.id} className="text-slate-200">
                      <td className="py-3 font-bold text-rose-400">{t.ticket_number}</td>
                      <td className="py-3 font-sans">
                        <div className="font-semibold text-white">{t.driver_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{t.vehicle_plate || "—"}</div>
                      </td>
                      <td className="py-3 text-[11px] text-slate-300 font-sans">{t.category}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.urgency === "CRITICAL_SOS"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                              : t.urgency === "HIGH"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {t.urgency}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === "RESOLVED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : t.status === "STAFF_DISPATCHED"
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300 font-sans">{t.assigned_staff_name || "Unassigned"}</td>
                      <td className="py-3 text-right space-x-2 font-sans">
                        {t.status === "SUBMITTED" && (
                          <button
                            onClick={() => handleUpdateTicketStatus(t.ticket_number, "STAFF_DISPATCHED")}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition"
                          >
                            Dispatch Staff
                          </button>
                        )}
                        {t.status === "STAFF_DISPATCHED" && (
                          <button
                            onClick={() => handleUpdateTicketStatus(t.ticket_number, "RESOLVED")}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition"
                          >
                            Resolve Ticket
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
