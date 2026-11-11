"use client";

import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Float } from "@react-three/drei";
import * as THREE from "three";
import { ParkingSlot } from "@/types";

interface BayMeshProps {
  position: [number, number, number];
  slot: ParkingSlot;
  isSelected: boolean;
  onSelect?: (slot: ParkingSlot) => void;
}

function ParkingBayMesh({
  position,
  slot,
  isSelected,
  onSelect,
}: BayMeshProps) {
  const carRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (carRef.current && isSelected) {
      carRef.current.position.y =
        0.28 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
    }
  });

  const bayColor = useMemo(() => {
    if (isSelected) return "#0052FF";
    if (slot.status === "AVAILABLE") {
      return slot.slot_type === "EV_CHARGING" ? "#10B981" : "#3B82F6";
    }
    if (slot.status === "RESERVED") return "#F59E0B";
    if (slot.status === "OCCUPIED") return "#64748B";
    return "#EF4444";
  }, [slot.status, slot.slot_type, isSelected]);

  const hasVehicle =
    slot.status === "OCCUPIED" || slot.status === "RESERVED" || isSelected;

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(slot);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Bay Floor Pad */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[1.6, 0.06, 2.7]} />
        <meshStandardMaterial
          color={hovered ? "#DBEAFE" : "#F8FAFC"}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>

      {/* Glowing Perimeter Sensor Strip */}
      <mesh position={[0, 0.07, 1.25]}>
        <boxGeometry args={[1.45, 0.04, 0.12]} />
        <meshStandardMaterial
          color={bayColor}
          emissive={bayColor}
          emissiveIntensity={isSelected || hovered ? 0.85 : 0.45}
        />
      </mesh>

      {/* EV Supercharger Totem if EV Bay */}
      {slot.slot_type === "EV_CHARGING" && (
        <group position={[0, 0.45, -1.2]}>
          <mesh castShadow>
            <boxGeometry args={[0.28, 0.8, 0.18]} />
            <meshStandardMaterial color="#0F172A" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.15, 0.1]}>
            <boxGeometry args={[0.16, 0.28, 0.02]} />
            <meshStandardMaterial
              color="#10B981"
              emissive="#10B981"
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      )}

      {/* 3D Stylized Vehicle Model when Occupied / Reserved / Selected */}
      {hasVehicle && (
        <group ref={carRef} position={[0, 0.26, 0]}>
          {/* Chassis */}
          <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
            <boxGeometry args={[1.15, 0.32, 2.15]} />
            <meshStandardMaterial
              color={
                isSelected
                  ? "#0052FF"
                  : slot.status === "RESERVED"
                  ? "#F59E0B"
                  : "#1E293B"
              }
              metalness={0.6}
              roughness={0.25}
            />
          </mesh>
          {/* Glass Cabin */}
          <mesh castShadow position={[0, 0.32, -0.1]}>
            <boxGeometry args={[0.96, 0.24, 1.15]} />
            <meshStandardMaterial
              color="#E2E8F0"
              metalness={0.8}
              roughness={0.15}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

function AutonomousShuttleDrone() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.65;
    ref.current.position.x = Math.sin(t) * 5.2;
  });

  return (
    <group ref={ref} position={[0, 0.25, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.9, 0.32, 1.05]} />
        <meshStandardMaterial
          color="#0052FF"
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[1.2, 0.2, 0.9]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.15} />
      </mesh>
    </group>
  );
}

interface SmartParkingCanvasProps {
  slots: ParkingSlot[];
  selectedSlotId?: number | null;
  onSelectSlot?: (slot: ParkingSlot) => void;
  activeFloor?: number;
}

export function SmartParkingCanvas({
  slots,
  selectedSlotId = null,
  onSelectSlot,
  activeFloor = 1,
}: SmartParkingCanvasProps) {
  const floorSlots = useMemo(() => {
    const filtered = slots.filter((s) => s.floor === activeFloor);
    return filtered.length > 0 ? filtered.slice(0, 8) : slots.slice(0, 8);
  }, [slots, activeFloor]);

  return (
    <div className="relative h-[380px] w-full overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-slate-50 via-white to-blue-50/40 shadow-apple">
      {/* Top Overlay Telemetry HUD */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-brand-200 bg-white/90 px-3 py-1 text-[11px] font-bold text-brand-600 shadow-sm backdrop-blur-md">
          3D DIGITAL TWIN • DECK FLOOR 0{activeFloor}
        </span>
        <span className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 backdrop-blur-md">
          Drag to Orbit • Click Any Bay to Select
        </span>
      </div>

      {/* Bottom Legend HUD */}
      <div className="pointer-events-none absolute bottom-3 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/85 px-3.5 py-2 text-[11px] font-medium text-slate-600 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            Available Bay
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            EV 50kW Fast-Charge
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Reserved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
            Occupied
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">
          IoT Ultrasonic + ANPR Telemetry: 60Hz
        </span>
      </div>

      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 9.5, 11.5]} fov={38} />
        <OrbitControls
          enablePan={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.3}
          minDistance={7}
          maxDistance={16}
        />

        <ambientLight intensity={0.95} />
        <directionalLight
          position={[8, 14, 10]}
          intensity={1.2}
          castShadow
        />
        <pointLight position={[0, 5, 0]} intensity={0.4} color="#0052FF" />

        {/* Architectural Deck Base */}
        <mesh position={[0, -0.08, 0]} receiveShadow>
          <boxGeometry args={[14.5, 0.16, 9.2]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.5} />
        </mesh>

        {/* Central Autonomous Driving Lane */}
        <mesh position={[0, 0.01, 0]} receiveShadow>
          <boxGeometry args={[13.8, 0.02, 2.4]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.6} />
        </mesh>

        {/* Animated Guide Vehicle in Central Lane */}
        <AutonomousShuttleDrone />

        {/* North Row (4 Bays) */}
        {floorSlots.slice(0, 4).map((slot, index) => {
          const x = -4.5 + index * 3.0;
          return (
            <ParkingBayMesh
              key={slot.id}
              position={[x, 0, -2.7]}
              slot={slot}
              isSelected={selectedSlotId === slot.id}
              onSelect={onSelectSlot}
            />
          );
        })}

        {/* South Row (4 Bays) */}
        {floorSlots.slice(4, 8).map((slot, index) => {
          const x = -4.5 + index * 3.0;
          return (
            <ParkingBayMesh
              key={slot.id}
              position={[x, 0, 2.7]}
              slot={slot}
              isSelected={selectedSlotId === slot.id}
              onSelect={onSelectSlot}
            />
          );
        })}

        {/* Floating Telemetry Beacon */}
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.4}>
          <mesh position={[6.2, 1.4, -3.6]}>
            <octahedronGeometry args={[0.32, 0]} />
            <meshStandardMaterial
              color="#0052FF"
              emissive="#0052FF"
              emissiveIntensity={0.5}
              wireframe
            />
          </mesh>
        </Float>
      </Canvas>
    </div>
  );
}
