"use client";

import React, { useEffect, useState } from "react";
import {
  corporateBiApi,
  CorporateAccount,
  CorporateEmployee,
  CorporateInvoice,
  ParkingSubscriptionPlan,
  UserSubscription,
  MultiFacilityBIAnalyticsResponse,
  AIBusinessInsight,
} from "@/lib/corporateBiApi";
import {
  Building2,
  Users,
  CreditCard,
  BarChart3,
  Brain,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  FileText,
  DollarSign,
  ChevronRight,
  Layers,
  MapPin,
  RefreshCw,
  Plus,
  Car,
  AlertOctagon,
  Percent,
} from "lucide-react";

export default function EnterpriseBiHub() {
  const [activeTab, setActiveTab] = useState<"corporate" | "subscriptions" | "analytics" | "ai_insights">("corporate");
  const [selectedCity, setSelectedCity] = useState<string>("ALL");

  // State
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<CorporateAccount | null>(null);
  const [employees, setEmployees] = useState<CorporateEmployee[]>([]);
  const [invoices, setInvoices] = useState<CorporateInvoice[]>([]);
  const [plans, setPlans] = useState<ParkingSubscriptionPlan[]>([]);
  const [userSubs, setUserSubs] = useState<UserSubscription[]>([]);
  const [biData, setBiData] = useState<MultiFacilityBIAnalyticsResponse | null>(null);
  const [aiInsights, setAiInsights] = useState<AIBusinessInsight[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Modals & forms
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    employee_id_code: "",
    full_name: "",
    email: "",
    department: "Engineering",
    vehicle_plate: "",
    parking_policy: "SHARED_POOL",
    reserved_slot_code: "",
    monthly_allowance_hours: 160,
  });

  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaInput, setQuotaInput] = useState<number>(50);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [selectedCity]);

  async function loadAllData() {
    setLoading(true);
    try {
      const [accs, invs, plns, subs, bi, insights] = await Promise.all([
        corporateBiApi.getAccounts(),
        corporateBiApi.getInvoices(),
        corporateBiApi.getSubscriptionPlans(),
        corporateBiApi.getUserSubscriptions(),
        corporateBiApi.getMultiFacilityBI(selectedCity),
        corporateBiApi.getAIBusinessInsights(selectedCity),
      ]);

      setAccounts(accs);
      if (accs.length > 0 && !selectedAccount) {
        setSelectedAccount(accs[0]);
        const emps = await corporateBiApi.getEmployees(accs[0].id);
        setEmployees(emps);
      } else if (selectedAccount) {
        const emps = await corporateBiApi.getEmployees(selectedAccount.id);
        setEmployees(emps);
      }

      setInvoices(invs);
      setPlans(plns);
      setUserSubs(subs);
      setBiData(bi);
      setAiInsights(insights);
    } catch (err: any) {
      console.error(err);
      setBannerMessage({ text: err.message || "Failed to load enterprise data", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectAccount(acc: CorporateAccount) {
    setSelectedAccount(acc);
    setLoading(true);
    try {
      const emps = await corporateBiApi.getEmployees(acc.id);
      setEmployees(emps);
    } catch (err: any) {
      setBannerMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccount) return;
    try {
      await corporateBiApi.inviteEmployee(selectedAccount.id, inviteForm);
      setBannerMessage({ text: `Employee ${inviteForm.full_name} enrolled successfully!`, type: "success" });
      setShowInviteModal(false);
      setInviteForm({
        employee_id_code: "",
        full_name: "",
        email: "",
        department: "Engineering",
        vehicle_plate: "",
        parking_policy: "SHARED_POOL",
        reserved_slot_code: "",
        monthly_allowance_hours: 160,
      });
      loadAllData();
    } catch (err: any) {
      setBannerMessage({ text: err.message || "Failed to enroll employee", type: "error" });
    }
  }

  async function handleUpdateQuotaSubmit() {
    if (!selectedAccount) return;
    try {
      await corporateBiApi.updateQuota(selectedAccount.id, quotaInput);
      setBannerMessage({ text: `Parking quota updated to ${quotaInput} slots for ${selectedAccount.company_name}`, type: "success" });
      setShowQuotaModal(false);
      loadAllData();
    } catch (err: any) {
      setBannerMessage({ text: err.message, type: "error" });
    }
  }

  async function handleGenerateInvoice() {
    if (!selectedAccount) return;
    try {
      const inv = await corporateBiApi.generateInvoice(selectedAccount.id, "November 2026");
      setBannerMessage({ text: `Generated Corporate Statement: ${inv.invoice_number} (₹${inv.total_payable_inr.toLocaleString()})`, type: "success" });
      loadAllData();
    } catch (err: any) {
      setBannerMessage({ text: err.message, type: "error" });
    }
  }

  async function handlePayInvoice(invoiceId: number) {
    try {
      await corporateBiApi.payInvoice(invoiceId, `NEFT-SETTLE-${Date.now().toString().slice(-6)}`);
      setBannerMessage({ text: "Invoice marked as PAID and settled via bank reconciliation.", type: "success" });
      loadAllData();
    } catch (err: any) {
      setBannerMessage({ text: err.message, type: "error" });
    }
  }

  async function handleSimulateFailure(subId: number) {
    try {
      const res = await corporateBiApi.simulatePaymentFailure(subId, "Credit card recurring authorization failed");
      setBannerMessage({ text: res.message, type: "info" });
      loadAllData();
    } catch (err: any) {
      setBannerMessage({ text: err.message, type: "error" });
    }
  }

  async function handleRenewSubscription(subId: number) {
    try {
      const res = await corporateBiApi.renewSubscription(subId);
      setBannerMessage({ text: res.message, type: "success" });
      loadAllData();
    } catch (err: any) {
      setBannerMessage({ text: err.message, type: "error" });
    }
  }

  async function handleCancelSubscription(subId: number) {
    try {
      const res = await corporateBiApi.cancelSubscription(subId, "Driver requested cancellation");
      setBannerMessage({ text: res.message, type: "info" });
      loadAllData();
    } catch (err: any) {
      setBannerMessage({ text: err.message, type: "error" });
    }
  }

  async function handleDecideInsight(insightId: number, decision: "APPROVED" | "REJECTED") {
    try {
      const res = await corporateBiApi.decideAIInsight(
        insightId,
        decision,
        `Human Operator decision: ${decision} executed via executive console.`
      );
      setBannerMessage({ text: res.execution_message, type: decision === "APPROVED" ? "success" : "info" });
      loadAllData();
    } catch (err: any) {
      setBannerMessage({ text: err.message, type: "error" });
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Top Banner Message */}
      {bannerMessage && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border backdrop-blur-md transition-all ${
            bannerMessage.type === "success"
              ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
              : bannerMessage.type === "error"
              ? "bg-rose-950/80 border-rose-500/50 text-rose-200"
              : "bg-cyan-950/80 border-cyan-500/50 text-cyan-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {bannerMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : bannerMessage.type === "error" ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-xs uppercase px-2 py-1 bg-black/30 hover:bg-black/50 rounded-md font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Phase 20 Enterprise Platform
            </span>
            <span className="px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              National Grid Active
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-cyan-400" />
            Corporate Parking, Subscriptions & Multi-City BI
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Enterprise fleet mobility, recurring subscription tiers, multi-region operational telemetry & AI guardrails.
          </p>
        </div>

        {/* Global Action / City Selector */}
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
          <MapPin className="w-4 h-4 text-slate-400 ml-2" />
          <span className="text-xs text-slate-400 font-medium">Cluster:</span>
          {["ALL", "Gurugram", "Delhi", "Mumbai", "Bengaluru"].map((city) => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                selectedCity === city
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {city}
            </button>
          ))}
          <button
            onClick={loadAllData}
            title="Refresh All Telemetry"
            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors ml-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Pillar Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("corporate")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === "corporate"
              ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Corporate Accounts & Fleet</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-950 text-cyan-300 font-mono">
            {accounts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("subscriptions")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === "subscriptions"
              ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Recurring Subscriptions</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-950 text-blue-300 font-mono">
            {userSubs.length} Passes
          </span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === "analytics"
              ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Multi-City BI & Revenue Leakage</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-950 text-emerald-300 font-mono">
            {biData?.consolidated_total_facilities || 4} Sites
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ai_insights")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === "ai_insights"
              ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
          }`}
        >
          <Brain className="w-4 h-4 text-purple-400" />
          <span>AI Intelligence & Approval Hub</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-950 text-purple-300 font-mono">
            {aiInsights.filter((i) => i.approval_status === "PENDING_APPROVAL").length} Pending
          </span>
        </button>
      </div>

      {/* TAB 1: CORPORATE ACCOUNTS & FLEET */}
      {activeTab === "corporate" && (
        <div className="space-y-6">
          {/* Top row: Corporate selector cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const isSelected = selectedAccount?.id === acc.id;
              const quotaPct = Math.round((acc.allocated_slots / Math.max(1, acc.monthly_quota_slots)) * 100);

              return (
                <div
                  key={acc.id}
                  onClick={() => handleSelectAccount(acc)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? "bg-gradient-to-b from-slate-900 to-slate-950 border-cyan-500/60 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">
                        GST: {acc.gstin}
                      </span>
                      <h3 className="text-base font-bold text-white mt-1">{acc.company_name}</h3>
                      <p className="text-xs text-cyan-400 font-mono mt-0.5">@{acc.domain || "enterprise.com"}</p>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {acc.status}
                    </span>
                  </div>

                  {/* Quota Progress */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-400">Quota Consumption</span>
                      <span className="font-mono font-bold text-slate-200">
                        {acc.allocated_slots} / {acc.monthly_quota_slots} slots ({quotaPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all rounded-full ${
                          quotaPct >= 90 ? "bg-rose-500" : quotaPct >= 70 ? "bg-amber-400" : "bg-cyan-400"
                        }`}
                        style={{ width: `${Math.min(100, quotaPct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>Cycle: Day {acc.billing_cycle_day}</span>
                    <span className="text-cyan-400 flex items-center gap-1 font-sans font-medium">
                      Manage Fleet <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Selected Corporate Deck */}
          {selectedAccount && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Employee Roster */}
              <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-cyan-400" />
                      Employee Parking Roster — {selectedAccount.company_name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {employees.length} active employee permits allotted against monthly allowance.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setQuotaInput(selectedAccount.monthly_quota_slots);
                        setShowQuotaModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      Adjust Quota
                    </button>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Enroll Employee
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-900 text-xs uppercase text-slate-400 font-mono border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Dept & ID</th>
                        <th className="px-4 py-3">Vehicle</th>
                        <th className="px-4 py-3">Policy / Bay</th>
                        <th className="px-4 py-3">Allowance</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{emp.full_name}</div>
                            <div className="text-xs text-slate-400">{emp.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-300">{emp.department}</span>
                            <div className="text-xs text-slate-400 font-mono">{emp.employee_id_code}</div>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-cyan-300">
                            {emp.vehicle_plate}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 text-xs font-mono font-medium rounded ${
                                emp.parking_policy === "EXECUTIVE_VIP"
                                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                  : emp.parking_policy === "RESERVED_BAY"
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {emp.parking_policy}
                            </span>
                            {emp.reserved_slot_code && (
                              <div className="text-xs text-amber-400 font-mono mt-0.5">
                                Bay: {emp.reserved_slot_code}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">
                            <span className="text-slate-200">{emp.used_hours_current_month}h</span> / {emp.monthly_allowance_hours}h
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {emp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right 1 Col: Invoicing & Billing Deck */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    Enterprise Invoices
                  </h3>
                  <button
                    onClick={handleGenerateInvoice}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Bill Month
                  </button>
                </div>

                <div className="space-y-3">
                  {invoices
                    .filter((inv) => inv.corporate_id === selectedAccount.id)
                    .map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 space-y-2 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-xs font-mono font-bold text-cyan-400">{inv.invoice_number}</div>
                            <div className="text-sm font-semibold text-white">{inv.billing_period}</div>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-xs font-mono font-semibold rounded ${
                              inv.payment_status === "PAID"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {inv.payment_status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800 font-mono">
                          <div>
                            Active Seats: <span className="text-slate-200">{inv.total_active_employees}</span>
                          </div>
                          <div>
                            Sessions: <span className="text-slate-200">{inv.total_park_sessions}</span>
                          </div>
                          <div>
                            Hours: <span className="text-slate-200">{inv.total_hours_consumed}h</span>
                          </div>
                          <div>
                            GST (18%): <span className="text-slate-200">₹{inv.gst_amount_inr.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-mono">
                          <span className="text-xs text-slate-400">Total Payable</span>
                          <span className="text-sm font-extrabold text-emerald-400">
                            ₹{inv.total_payable_inr.toLocaleString()}
                          </span>
                        </div>

                        {inv.payment_status === "PENDING" && (
                          <button
                            onClick={() => handlePayInvoice(inv.id)}
                            className="w-full mt-2 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-sm"
                          >
                            Confirm Bank Settlement
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECURRING SUBSCRIPTIONS */}
      {activeTab === "subscriptions" && (
        <div className="space-y-6">
          {/* Top row: Available Subscription Tiers */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-400" />
              Published Recurring Parking Pass Catalog
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-3 transition-colors relative overflow-hidden"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono uppercase text-cyan-400 font-semibold">{p.tier}</span>
                      <h4 className="text-base font-bold text-white mt-0.5">{p.name}</h4>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {p.facility_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-extrabold text-emerald-400 font-mono">
                        ₹{p.price_monthly_inr.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">per {p.validity_days} days</div>
                    </div>
                  </div>

                  {/* Access rules */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Access Hours:</span>
                      <span className="text-slate-200">
                        {p.access_hours_start} - {p.access_hours_end}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Valid Days:</span>
                      <span className="text-cyan-300 font-sans font-medium">{p.allowed_days.join(", ")}</span>
                    </div>
                  </div>

                  {/* Features list */}
                  <ul className="text-xs text-slate-400 space-y-1.5">
                    {p.features.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Active Subscriber Passes List */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  Active Subscriber Passes & Validity Audit
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time driver subscriptions, access hour compliance, auto-renewal controls & failure grace periods.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900 text-xs uppercase text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Pass & Tier</th>
                    <th className="px-4 py-3">Vehicle Plate</th>
                    <th className="px-4 py-3">Facility Access</th>
                    <th className="px-4 py-3">Validity & Days Left</th>
                    <th className="px-4 py-3">Access Gate Status</th>
                    <th className="px-4 py-3">Renewal Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {userSubs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{sub.plan_name}</div>
                        <span className="text-xs font-mono text-cyan-400">{sub.tier}</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-cyan-300">
                        {sub.vehicle_plate}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-slate-200">{sub.facility_name}</div>
                        <div className="text-slate-400 font-mono">
                          {sub.access_hours_start} - {sub.access_hours_end}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${sub.days_remaining <= 3 ? "text-amber-400" : "text-emerald-400"}`}>
                            {sub.days_remaining} days left
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">Expires: {new Date(sub.end_date).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1 w-max ${
                            sub.is_valid_now
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sub.is_valid_now ? "bg-emerald-400" : "bg-rose-400"}`} />
                          {sub.is_valid_now ? "GATE ENTRY PERMITTED" : "HOURS RESTRICTED"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-mono font-semibold rounded ${
                            sub.renewal_status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : sub.renewal_status === "PAYMENT_FAILED"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {sub.renewal_status}
                        </span>
                        {sub.failed_payment_reason && (
                          <div className="text-xs text-rose-400 mt-1 max-w-xs font-mono">
                            {sub.failed_payment_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {sub.renewal_status === "ACTIVE" && (
                            <button
                              onClick={() => handleSimulateFailure(sub.id)}
                              title="Test payment failure handling with 72h grace period"
                              className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 transition-colors"
                            >
                              Simulate Debit Fail
                            </button>
                          )}
                          <button
                            onClick={() => handleRenewSubscription(sub.id)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-colors"
                          >
                            Renew
                          </button>
                          <button
                            onClick={() => handleCancelSubscription(sub.id)}
                            className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MULTI-CITY BI & REVENUE LEAKAGE */}
      {activeTab === "analytics" && biData && (
        <div className="space-y-6">
          {/* Top Executive KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Managed Facilities</span>
              <div className="text-2xl font-black text-white font-mono">{biData.consolidated_total_facilities}</div>
              <span className="text-xs text-cyan-400 flex items-center gap-1 font-mono">4 Metro Hubs</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Total Smart Bays</span>
              <div className="text-2xl font-black text-white font-mono">{biData.consolidated_total_slots.toLocaleString()}</div>
              <span className="text-xs text-emerald-400 font-mono">100% Sensorized</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">National Occupancy</span>
              <div className="text-2xl font-black text-cyan-400 font-mono">{biData.consolidated_occupancy_pct}%</div>
              <span className="text-xs text-slate-400 font-mono">Peak Baseline</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Monthly Revenue</span>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                ₹{(biData.consolidated_monthly_revenue_inr / 100000).toFixed(1)}L
              </div>
              <span className="text-xs text-emerald-400 font-mono">+18.4% vs Last Mo</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Booking Conversion</span>
              <div className="text-2xl font-black text-white font-mono">{biData.consolidated_conversion_rate_pct}%</div>
              <span className="text-xs text-cyan-400 font-mono">Search-to-Gate</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Revenue Leakage</span>
              <div className="text-2xl font-black text-rose-400 font-mono">
                ₹{biData.consolidated_leakage_inr.toLocaleString()}
              </div>
              <span className="text-xs text-rose-400 font-mono">Remedies Identified</span>
            </div>
          </div>

          {/* Mid row: Peak Hours Distribution + 7-Day Forecast */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak Hours Curve */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                    Hourly Occupancy Curve & Commuter Demand
                  </h3>
                  <p className="text-xs text-slate-400">Peak hour surges recorded between 09:00 - 10:30 & 18:00 - 19:30.</p>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-2">
                {biData.peak_hours.map((ph, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border text-center flex flex-col justify-between h-24 ${
                      ph.status === "PEAK"
                        ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                        : ph.status === "NORMAL"
                        ? "bg-slate-900 border-slate-800 text-slate-300"
                        : "bg-slate-950 border-slate-800/60 text-slate-400"
                    }`}
                  >
                    <span className="text-xs font-mono">{ph.hour}</span>
                    <div className="text-base font-black font-mono">{ph.occupancy_pct}%</div>
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider rounded ${
                        ph.status === "PEAK" ? "text-rose-400" : "text-slate-400"
                      }`}
                    >
                      {ph.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 7-Day AI Demand Projections */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    7-Day Forecasted Parking Influx
                  </h3>
                  <p className="text-xs text-slate-400">Predictive neural regression model with calendar and enterprise factors.</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {biData.forecasted_demand_7d.map((fc, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-cyan-400 w-10">{fc.day_name}</span>
                      <div>
                        <div className="text-slate-200 font-semibold">{fc.factor}</div>
                        <div className="text-slate-400 font-mono">{fc.date}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-white font-mono">{fc.predicted_occupancy_pct}%</div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        {(fc.confidence * 100).toFixed(0)}% Confidence
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Underused Zones & Revenue Leakage Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Underused Zones */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Underutilized Zones Detected
              </h3>
              <div className="space-y-3">
                {biData.underused_zones.map((uz, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-white">{uz.facility}</div>
                        <div className="text-xs text-amber-400 font-mono">
                          {uz.level} — {uz.zone} ({uz.total_slots} Bays)
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {uz.occupancy_pct}% Occupancy
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-cyan-400 font-semibold">AI Recommendation: </span>
                      {uz.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Leakage Audit Log */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-400" />
                Revenue Leakage & Security Discrepancy Log
              </h3>
              <div className="space-y-3">
                {biData.revenue_leakages.map((rl, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-white">{rl.category}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {rl.incident_count} events recorded this week
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-rose-400 font-mono">
                          -₹{rl.loss_inr.toLocaleString()}
                        </span>
                        <div className="text-[10px] font-mono text-slate-400">{rl.status}</div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-emerald-400 font-semibold">Remedy Action: </span>
                      {rl.remedy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Facility-by-Facility Comparative Matrix */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              Multi-Facility Comparative Operational Matrix
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900 text-xs uppercase text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Facility Name</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Total Bays</th>
                    <th className="px-4 py-3">Occupancy %</th>
                    <th className="px-4 py-3">Monthly Revenue</th>
                    <th className="px-4 py-3">Overstays</th>
                    <th className="px-4 py-3">Corp Subscribers</th>
                    <th className="px-4 py-3">Efficiency Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {biData.facility_comparisons.map((fc) => (
                    <tr key={fc.facility_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{fc.facility_name}</td>
                      <td className="px-4 py-3 text-cyan-300 font-mono text-xs">{fc.city}</td>
                      <td className="px-4 py-3 font-mono text-xs">{fc.total_slots}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <span className="text-emerald-400 font-bold">{fc.current_occupancy_pct}%</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white font-bold">
                        ₹{fc.monthly_revenue_inr.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-amber-400">{fc.overstay_count}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{fc.corporate_subscribers}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold">
                          {fc.efficiency_score}/100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AI STRATEGIC INTELLIGENCE & APPROVAL HUB */}
      {activeTab === "ai_insights" && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex items-start gap-4">
            <Brain className="w-8 h-8 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-white">
                Human-in-the-Loop Operational Guardrail Engine
              </h3>
              <p className="text-xs text-purple-200/80 mt-1 leading-relaxed">
                Parkwise AI generates strategic recommendations for dynamic pricing, capacity reallocation, and leakage remediation.
                Under platform safety policies, <strong className="text-white">no consequential system change takes effect</strong> without explicit sign-off from an authorized human operator.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {aiInsights.map((insight) => (
              <div
                key={insight.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-colors"
              >
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {insight.category}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Cluster: <strong className="text-slate-200">{insight.city}</strong> • {insight.facility_name}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{insight.title}</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Confidence</div>
                      <div className="text-sm font-extrabold text-cyan-400 font-mono">
                        {(insight.confidence_score * 100).toFixed(0)}%
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs font-mono font-bold rounded-lg ${
                        insight.approval_status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : insight.approval_status === "REJECTED"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse"
                      }`}
                    >
                      {insight.approval_status === "PENDING_APPROVAL" ? "PENDING OPERATOR APPROVAL" : insight.approval_status}
                    </span>
                  </div>
                </div>

                {/* Plain language summary */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">
                    Plain-Language Analysis & Rationale
                  </h4>
                  <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80">
                    {insight.plain_language_summary}
                  </p>
                </div>

                {/* Explicit Data Assumptions */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                    Explicit Data Assumptions
                  </h4>
                  <ul className="space-y-1.5">
                    {insight.data_assumptions.map((assump, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                        <span>{assump}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Projected Impact & Action Proposed */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block font-mono">Projected Impact:</span>
                    <span className="text-emerald-400 font-bold text-sm mt-0.5 block">{insight.projected_impact}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono">Proposed Execution:</span>
                    <span className="text-cyan-300 font-mono font-medium text-xs mt-0.5 block">{insight.action_proposed}</span>
                  </div>
                </div>

                {/* Operator Approval / Decision Action Bar */}
                {insight.approval_status === "PENDING_APPROVAL" ? (
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                    <button
                      onClick={() => handleDecideInsight(insight.id, "REJECTED")}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Proposal
                    </button>
                    <button
                      onClick={() => handleDecideInsight(insight.id, "APPROVED")}
                      className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-md shadow-emerald-500/20 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve & Execute System Change
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 text-xs text-slate-400 font-mono">
                    Audit Notes: <span className="text-slate-300">{insight.operator_notes || "Resolved"}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: ENROLL EMPLOYEE */}
      {showInviteModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                Enroll Employee Permit
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={inviteForm.full_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                    placeholder="e.g. Tanvi Sharma"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Corporate Email</label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder={`e.g. tanvi@${selectedAccount.domain || "company.com"}`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Employee ID Code</label>
                  <input
                    type="text"
                    required
                    value={inviteForm.employee_id_code}
                    onChange={(e) => setInviteForm({ ...inviteForm, employee_id_code: e.target.value })}
                    placeholder="e.g. EMP-9921"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Vehicle Plate</label>
                  <input
                    type="text"
                    required
                    value={inviteForm.vehicle_plate}
                    onChange={(e) => setInviteForm({ ...inviteForm, vehicle_plate: e.target.value.toUpperCase() })}
                    placeholder="e.g. HR26DL4400"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Department</label>
                  <input
                    type="text"
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Parking Policy</label>
                  <select
                    value={inviteForm.parking_policy}
                    onChange={(e) => setInviteForm({ ...inviteForm, parking_policy: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="SHARED_POOL">SHARED_POOL (Shared Fleet)</option>
                    <option value="RESERVED_BAY">RESERVED_BAY (Assigned Slot)</option>
                    <option value="EXECUTIVE_VIP">EXECUTIVE_VIP (Executive Reserved)</option>
                  </select>
                </div>
              </div>

              {inviteForm.parking_policy !== "SHARED_POOL" && (
                <div>
                  <label className="text-slate-400 block mb-1">Assigned Slot / Bay Code</label>
                  <input
                    type="text"
                    value={inviteForm.reserved_slot_code}
                    onChange={(e) => setInviteForm({ ...inviteForm, reserved_slot_code: e.target.value })}
                    placeholder="e.g. B1-A12"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Confirm Allotment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADJUST QUOTA */}
      {showQuotaModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Adjust Corporate Slot Quota</h3>
            <p className="text-xs text-slate-400">
              Configure total permitted employee permits for {selectedAccount.company_name}.
            </p>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Monthly Slot Quota</label>
              <input
                type="number"
                min={selectedAccount.allocated_slots}
                max={500}
                value={quotaInput}
                onChange={(e) => setQuotaInput(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-base focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block font-mono">
                Currently allocated: {selectedAccount.allocated_slots}
              </span>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowQuotaModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateQuotaSubmit}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              >
                Save Quota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
