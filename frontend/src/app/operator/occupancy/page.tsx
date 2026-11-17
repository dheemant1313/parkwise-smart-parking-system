"use client";

import React from "react";
import LiveOccupancyConsole from "@/components/operator/LiveOccupancyConsole";

export default function OperatorOccupancyPage() {
  return (
    <main className="min-h-screen bg-[#070D18]">
      <LiveOccupancyConsole facilityId={1} />
    </main>
  );
}
