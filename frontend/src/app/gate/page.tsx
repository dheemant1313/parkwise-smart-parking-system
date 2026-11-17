"use client";

import React from "react";
import { ProtectedRouteGate } from "@/components/auth/ProtectedRouteGate";
import { GateTerminalConsole } from "@/components/gate/GateTerminalConsole";

export default function GatePage() {
  return (
    <ProtectedRouteGate
      allowedRoles={["GATE_STAFF", "OPERATOR", "ADMIN"]}
      applicationName="Gate Terminal & ANPR Controller"
    >
      <GateTerminalConsole />
    </ProtectedRouteGate>
  );
}
