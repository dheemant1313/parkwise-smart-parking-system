/**
 * Phase 20: Enterprise Corporate Parking, Subscriptions & Multi-City BI Client
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface CorporateAccount {
  id: number;
  company_name: string;
  gstin: string;
  domain?: string;
  contact_email: string;
  contact_phone: string;
  billing_address: string;
  monthly_quota_slots: number;
  allocated_slots: number;
  remaining_slots: number;
  billing_cycle_day: number;
  status: "ACTIVE" | "SUSPENDED" | "DELINQUENT";
  created_at: string;
}

export interface CorporateEmployee {
  id: number;
  corporate_id: number;
  user_id?: number;
  employee_id_code: string;
  full_name: string;
  email: string;
  department: string;
  vehicle_plate: string;
  parking_policy: "SHARED_POOL" | "RESERVED_BAY" | "EXECUTIVE_VIP";
  reserved_slot_code?: string;
  monthly_allowance_hours: number;
  used_hours_current_month: number;
  status: "ACTIVE" | "SUSPENDED" | "OFFBOARDED";
  created_at: string;
}

export interface CorporateInvoice {
  id: number;
  corporate_id: number;
  company_name: string;
  invoice_number: string;
  billing_period: string;
  total_active_employees: number;
  total_park_sessions: number;
  total_hours_consumed: number;
  subtotal_inr: number;
  gst_amount_inr: number;
  discount_inr: number;
  total_payable_inr: number;
  payment_status: "PENDING" | "PAID" | "OVERDUE" | "FAILED";
  payment_reference?: string;
  issued_at: string;
  due_date: string;
  paid_at?: string;
}

export interface ParkingSubscriptionPlan {
  id: number;
  code: string;
  name: string;
  tier: string;
  facility_id?: number;
  facility_name?: string;
  price_monthly_inr: number;
  validity_days: number;
  access_hours_start: string;
  access_hours_end: string;
  allowed_days: string[];
  multi_facility: boolean;
  is_active: boolean;
  features: string[];
}

export interface UserSubscription {
  id: number;
  plan_id: number;
  plan_name: string;
  tier: string;
  user_id: number;
  vehicle_plate: string;
  facility_name: string;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  renewal_status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "PAYMENT_FAILED" | "RENEWED";
  days_remaining: number;
  total_sessions_used: number;
  grace_period_until?: string;
  last_payment_reference?: string;
  failed_payment_reason?: string;
  access_hours_start: string;
  access_hours_end: string;
  allowed_days: string[];
  multi_facility: boolean;
  is_valid_now: boolean;
}

export interface MultiCitySummaryMetric {
  city: string;
  total_facilities: number;
  total_slots: number;
  active_bookings: number;
  occupancy_rate: number;
  today_revenue_inr: number;
  leakage_amount_inr: number;
}

export interface PeakHourMetric {
  hour: string;
  occupancy_pct: number;
  status: "PEAK" | "NORMAL" | "LOW";
}

export interface UnderusedZoneMetric {
  facility: string;
  city: string;
  zone: string;
  level: string;
  total_slots: number;
  occupancy_pct: number;
  recommendation: string;
}

export interface RevenueLeakageMetric {
  category: string;
  incident_count: number;
  loss_inr: number;
  status: string;
  remedy: string;
}

export interface ForecastedDemandDay {
  date: string;
  day_name: string;
  predicted_occupancy_pct: number;
  confidence: number;
  factor: string;
}

export interface FacilityComparisonItem {
  facility_id: number;
  facility_name: string;
  city: string;
  total_slots: number;
  current_occupancy_pct: number;
  monthly_revenue_inr: number;
  overstay_count: number;
  corporate_subscribers: number;
  efficiency_score: number;
}

export interface MultiFacilityBIAnalyticsResponse {
  consolidated_total_facilities: number;
  consolidated_total_slots: number;
  consolidated_occupancy_pct: number;
  consolidated_monthly_revenue_inr: number;
  consolidated_active_bookings: number;
  consolidated_overstay_rate_pct: number;
  consolidated_no_show_rate_pct: number;
  consolidated_conversion_rate_pct: number;
  consolidated_leakage_inr: number;
  city_summaries: MultiCitySummaryMetric[];
  peak_hours: PeakHourMetric[];
  underused_zones: UnderusedZoneMetric[];
  revenue_leakages: RevenueLeakageMetric[];
  forecasted_demand_7d: ForecastedDemandDay[];
  facility_comparisons: FacilityComparisonItem[];
}

export interface AIBusinessInsight {
  id: number;
  facility_id?: number;
  facility_name?: string;
  city: string;
  category: string;
  title: string;
  plain_language_summary: string;
  data_assumptions: string[];
  projected_impact: string;
  confidence_score: number;
  action_proposed: string;
  action_payload?: Record<string, any>;
  requires_operator_approval: boolean;
  approval_status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXECUTED";
  operator_notes?: string;
  created_at: string;
  resolved_at?: string;
}

function getAuthHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-user-role": "OPERATOR",
    "x-user-email": "operator@parkwise.in",
  };
}

export const corporateBiApi = {
  // Corporate Accounts
  async getAccounts(): Promise<CorporateAccount[]> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/corporate/accounts`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load corporate accounts");
    return res.json();
  },

  async createAccount(data: {
    company_name: string;
    gstin: string;
    domain?: string;
    contact_email: string;
    contact_phone: string;
    billing_address: string;
    monthly_quota_slots: number;
    billing_cycle_day: number;
  }): Promise<CorporateAccount> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/corporate/accounts`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create corporate account");
    }
    return res.json();
  },

  async updateQuota(corporateId: number, quota: number): Promise<CorporateAccount> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/corporate/accounts/${corporateId}/quota`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ monthly_quota_slots: quota }),
    });
    if (!res.ok) throw new Error("Failed to update quota");
    return res.json();
  },

  // Employees
  async getEmployees(corporateId: number): Promise<CorporateEmployee[]> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/corporate/accounts/${corporateId}/employees`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load corporate employees");
    return res.json();
  },

  async inviteEmployee(
    corporateId: number,
    data: {
      employee_id_code: string;
      full_name: string;
      email: string;
      department: string;
      vehicle_plate: string;
      parking_policy: string;
      reserved_slot_code?: string;
      monthly_allowance_hours: number;
    }
  ): Promise<CorporateEmployee> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/corporate/accounts/${corporateId}/employees`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to invite corporate employee");
    }
    return res.json();
  },

  async updateEmployeeStatus(employeeId: number, status: string): Promise<CorporateEmployee> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/corporate/employees/${employeeId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update employee status");
    return res.json();
  },

  // Invoices
  async generateInvoice(corporateId: number, billingPeriod: string): Promise<CorporateInvoice> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/corporate/accounts/${corporateId}/invoices/generate`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ billing_period: billingPeriod }),
    });
    if (!res.ok) throw new Error("Failed to generate corporate invoice");
    return res.json();
  },

  async getInvoices(corporateId?: number): Promise<CorporateInvoice[]> {
    const url = corporateId
      ? `${API_BASE}/api/v1/enterprise/corporate/invoices?corporate_id=${corporateId}`
      : `${API_BASE}/api/v1/enterprise/corporate/invoices`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load invoices");
    return res.json();
  },

  async payInvoice(invoiceId: number, ref: string): Promise<CorporateInvoice> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/corporate/invoices/${invoiceId}/pay`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ payment_reference: ref }),
    });
    if (!res.ok) throw new Error("Failed to settle invoice");
    return res.json();
  },

  // Subscriptions
  async getSubscriptionPlans(): Promise<ParkingSubscriptionPlan[]> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/subscriptions/plans`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load subscription plans");
    return res.json();
  },

  async getUserSubscriptions(): Promise<UserSubscription[]> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/subscriptions?all_users=true`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load user subscriptions");
    return res.json();
  },

  async cancelSubscription(subId: number, reason: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/subscriptions/${subId}/cancel`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error("Failed to cancel subscription");
    return res.json();
  },

  async renewSubscription(subId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/subscriptions/${subId}/renew`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to renew subscription");
    return res.json();
  },

  async simulatePaymentFailure(subId: number, reason: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/subscriptions/${subId}/simulate-payment-failure`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ failure_reason: reason }),
    });
    if (!res.ok) throw new Error("Failed to simulate payment failure");
    return res.json();
  },

  // Multi-Facility BI
  async getMultiFacilityBI(city?: string): Promise<MultiFacilityBIAnalyticsResponse> {
    const url = city && city !== "ALL"
      ? `${API_BASE}/api/v1/enterprise/analytics/bi?city=${encodeURIComponent(city)}`
      : `${API_BASE}/api/v1/enterprise/analytics/bi`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load Multi-Facility BI analytics");
    return res.json();
  },

  // AI Strategic Insights
  async getAIBusinessInsights(city?: string): Promise<AIBusinessInsight[]> {
    const url = city && city !== "ALL"
      ? `${API_BASE}/api/v1/enterprise/ai/insights?city=${encodeURIComponent(city)}`
      : `${API_BASE}/api/v1/enterprise/ai/insights`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load AI business insights");
    return res.json();
  },

  async decideAIInsight(insightId: number, decision: "APPROVED" | "REJECTED", notes?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/v1/enterprise/ai/insights/${insightId}/decision`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ decision, operator_notes: notes || "Decision recorded by operator controller." }),
    });
    if (!res.ok) throw new Error("Failed to record decision on AI insight");
    return res.json();
  },
};
