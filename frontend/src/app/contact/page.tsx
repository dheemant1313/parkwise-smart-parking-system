"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  Send,
  Sparkles,
} from "lucide-react";

const REGIONAL_OFFICES = [
  {
    city: "New Delhi (NCR HQ)",
    address: "Level 9, Inner Circle Tower, Connaught Place, New Delhi 110001",
    phone: "+91-11-4092-8800",
    email: "delhi.grid@parkwise.in",
  },
  {
    city: "Mumbai (Western Grid)",
    address: "Maker Maxity, Bandra Kurla Complex (BKC), Mumbai 400051",
    phone: "+91-22-6120-9900",
    email: "mumbai.bkc@parkwise.in",
  },
  {
    city: "Bengaluru (AI & R&D Lab)",
    address: "100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038",
    phone: "+91-80-4811-7700",
    email: "blr.ai@parkwise.in",
  },
];

export default function ContactPage() {
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [city, setCity] = useState("New Delhi / NCR");
  const [inquiryType, setInquiryType] = useState(
    "Commercial Operator Onboarding"
  );
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 space-y-16">
      <div className="mx-auto max-w-3xl text-center space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
          <Sparkles className="h-3.5 w-3.5" />
          Enterprise Sales &amp; Support
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Connect With Our Mobility Architects.
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          Onboard your commercial parking facility, request an ANPR + FASTag
          hardware survey, or schedule a live walkthrough of the Parkwise cloud.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Left: Inquiry Form */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-apple lg:col-span-7">
          {submitted ? (
            <div className="py-12 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">
                Enterprise Inquiry Logged
              </h2>
              <p className="mx-auto max-w-md text-xs leading-relaxed text-slate-600">
                Thank you, <strong>{fullName}</strong>. Our regional solutions
                architect for <strong>{city}</strong> will reach out to{" "}
                <strong>{workEmail}</strong> within 4 business hours.
              </p>
              <div className="pt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setFullName("");
                    setWorkEmail("");
                    setOrganization("");
                    setMessage("");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Submit Another Inquiry
                </button>
                <Link
                  href="/operator"
                  className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white"
                >
                  Explore Operator Console →
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-lg font-bold text-slate-900">
                Request Operator Onboarding or Architecture Demo
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Vikramaditya Nair"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Work Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="vikram@prestigereit.in"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-org"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Organization / Facility Name
                  </label>
                  <input
                    id="contact-org"
                    type="text"
                    required
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="DLF CyberCity / NDMC"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-city"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Metropolitan Region
                  </label>
                  <select
                    id="contact-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900"
                  >
                    <option>New Delhi / NCR</option>
                    <option>Mumbai / MMR</option>
                    <option>Bengaluru</option>
                    <option>Hyderabad</option>
                    <option>Pune / Chennai / Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="contact-type"
                  className="block text-xs font-bold text-slate-700"
                >
                  Inquiry Scope
                </label>
                <select
                  id="contact-type"
                  value={inquiryType}
                  onChange={(e) => setInquiryType(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900"
                >
                  <option>Commercial Operator Onboarding</option>
                  <option>Smart City / Municipal RFP</option>
                  <option>ANPR + NPCI FASTag Gate Hardware Upgrade</option>
                  <option>EV 50kW Charging Fleet Partnership</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="contact-msg"
                  className="block text-xs font-bold text-slate-700"
                >
                  Facility Details (Approximate Bays, Floors &amp; Timeline)
                </label>
                <textarea
                  id="contact-msg"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="We operate a 450-bay multi-level basement in BKC and want to deploy optical ANPR + dynamic pricing..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3.5 text-xs font-medium text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-xs font-bold text-white shadow-stripe hover:bg-brand-700"
              >
                <Send className="h-4 w-4" />
                <span>Submit Enterprise Inquiry</span>
              </button>
            </form>
          )}
        </div>

        {/* Right: Regional Offices */}
        <div className="space-y-4 lg:col-span-5">
          {REGIONAL_OFFICES.map((off) => (
            <div
              key={off.city}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-2.5"
            >
              <div className="flex items-center gap-2 text-brand-600">
                <Building2 className="h-4 w-4" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {off.city}
                </h3>
              </div>
              <p className="flex items-start gap-2 text-xs text-slate-600">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>{off.address}</span>
              </p>
              <p className="flex items-center gap-2 text-xs font-mono text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>{off.phone}</span>
              </p>
              <p className="flex items-center gap-2 text-xs font-mono text-brand-600">
                <Mail className="h-3.5 w-3.5" />
                <span>{off.email}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
