"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Float } from "@react-three/drei";
import * as THREE from "three";
import { ParkingSlot } from "@/types";
import { Eye, Layers, Sparkles } from "lucide-react";

interface BayMeshProps {
  position: [number, number, number];
  slot: ParkingSlot;
  isSelected: boolean;
  reducedMotion: boolean;
  onSelect?: (slot: ParkingSlot) => void;
}

/**
 * Instanced Structural Columns for the Multi-Level Parking Garage
 */
function InstancedGarageColumns() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const columnPositions = useMemo< [number, number, number][] >(
    () => [
      [-6.4, 1.45, -4.1],
      [-2.1, 1.45, -4.1],
      [2.1, 1.45, -4.1],
      [6.4, 1.45, -4.1],
      [-6.4, 1.45, 4.1],
      [-2.1, 1.45, 4.1],
      [2.1, 1.45, 4.1],
      [6.4, 1.45, 4.1],
    ],
    []
  );

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    columnPositions.forEach((pos, idx) => {
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(idx, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [columnPositions]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, columnPositions.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[0.38, 2.9, 0.38]} />
      <meshStandardMaterial color="#CBD5E1" roughness={0.4} metalness={0.2} />
    </instancedMesh>
  );
}

/**
 * Instanced Bay Wheel Stops across North & South Bays
 */
function InstancedWheelStops() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const stopPositions = useMemo<[number, number, number][]>(() => {
    const arr: [number, number, number][] = [];
    for (let i = 0; i < 4; i++) {
      const x = -4.5 + i * 3.0;
      arr.push([x, 0.08, -3.65]);
      arr.push([x, 0.08, 3.65]);
    }
    return arr;
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    stopPositions.forEach((pos, idx) => {
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(idx, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [stopPositions]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, stopPositions.length]}
      castShadow
    >
      <boxGeometry args={[1.1, 0.08, 0.14]} />
      <meshStandardMaterial
        color="#0052FF"
        emissive="#0052FF"
        emissiveIntensity={0.35}
      />
    </instancedMesh>
  );
}

/**
 * Restrained Mouse Parallax Camera Controller
 */
function MouseParallaxRig({ enabled }: { enabled: boolean }) {
  const { camera, pointer } = useThree();
  const targetVec = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!enabled) return;
    // Subtle, restrained mouse parallax offset
    const targetX = pointer.x * 1.15;
    const targetY = 9.2 + pointer.y * 0.55;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.04);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.04);
    targetVec.set(pointer.x * 0.35, 0.2, 0);
    camera.lookAt(targetVec);
  });

  return null;
}

/**
 * Realistic Miniature Vehicle + Marked Parking Bay
 */
function ParkingBayMesh({
  position,
  slot,
  isSelected,
  reducedMotion,
  onSelect,
}: BayMeshProps) {
  const carRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (carRef.current && isSelected && !reducedMotion) {
      carRef.current.position.y =
        0.26 + Math.sin(state.clock.elapsedTime * 2.8) * 0.04;
    }
  });

  const bayColor = useMemo(() => {
    if (isSelected) return "#0052FF";
    if (slot.status === "AVAILABLE") {
      return slot.slot_type === "EV_CHARGING" ? "#10B981" : "#2563EB";
    }
    if (slot.status === "RESERVED") return "#F59E0B";
    if (slot.status === "OCCUPIED") return "#475569";
    return "#EF4444";
  }, [slot.status, slot.slot_type, isSelected]);

  const hasVehicle =
    slot.status === "OCCUPIED" || slot.status === "RESERVED" || isSelected;

  const isNorthRow = position[2] < 0;

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
      {/* Bay Epoxy Floor Pad */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[1.75, 0.05, 2.8]} />
        <meshStandardMaterial
          color={hovered ? "#DBEAFE" : "#F8FAFC"}
          roughness={0.3}
          metalness={0.08}
        />
      </mesh>

      {/* Left & Right Painted Bay Striping Lines */}
      <mesh position={[-0.92, 0.06, 0]}>
        <boxGeometry args={[0.05, 0.01, 2.8]} />
        <meshStandardMaterial color="#CBD5E1" />
      </mesh>
      <mesh position={[0.92, 0.06, 0]}>
        <boxGeometry args={[0.05, 0.01, 2.8]} />
        <meshStandardMaterial color="#CBD5E1" />
      </mesh>

      {/* Electric-Blue / Status IoT Edge Sensor Strip */}
      <mesh position={[0, 0.07, isNorthRow ? 1.32 : -1.32]}>
        <boxGeometry args={[1.55, 0.04, 0.12]} />
        <meshStandardMaterial
          color={bayColor}
          emissive={bayColor}
          emissiveIntensity={isSelected || hovered ? 0.95 : 0.5}
        />
      </mesh>

      {/* EV 50kW Supercharger Totem */}
      {slot.slot_type === "EV_CHARGING" && (
        <group position={[0, 0.48, isNorthRow ? -1.25 : 1.25]}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.88, 0.2]} />
            <meshStandardMaterial
              color="#0F172A"
              metalness={0.55}
              roughness={0.25}
            />
          </mesh>
          <mesh position={[0, 0.16, isNorthRow ? 0.11 : -0.11]}>
            <boxGeometry args={[0.18, 0.3, 0.02]} />
            <meshStandardMaterial
              color="#10B981"
              emissive="#10B981"
              emissiveIntensity={0.85}
            />
          </mesh>
        </group>
      )}

      {/* Realistic Miniature Vehicle */}
      {hasVehicle && (
        <group
          ref={carRef}
          position={[0, 0.26, 0]}
          rotation={[0, isNorthRow ? 0 : Math.PI, 0]}
        >
          {/* Lower Sculpted Body */}
          <mesh castShadow receiveShadow position={[0, 0.09, 0]}>
            <boxGeometry args={[1.18, 0.28, 2.22]} />
            <meshStandardMaterial
              color={
                isSelected
                  ? "#0052FF"
                  : slot.status === "RESERVED"
                  ? "#F59E0B"
                  : "#1E293B"
              }
              metalness={0.65}
              roughness={0.22}
            />
          </mesh>

          {/* Aerodynamic Glass Cabin */}
          <mesh castShadow position={[0, 0.31, -0.08]}>
            <boxGeometry args={[0.98, 0.23, 1.18]} />
            <meshStandardMaterial
              color="#E2E8F0"
              metalness={0.85}
              roughness={0.12}
            />
          </mesh>

          {/* 4 Wheels */}
          {[
            [-0.58, -0.02, 0.68],
            [0.58, -0.02, 0.68],
            [-0.58, -0.02, -0.68],
            [0.58, -0.02, -0.68],
          ].map((wPos, idx) => (
            <mesh
              key={idx}
              position={wPos as [number, number, number]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.16, 0.16, 0.12, 16]} />
              <meshStandardMaterial color="#0F172A" roughness={0.6} />
            </mesh>
          ))}

          {/* Front LED Headlights */}
          <mesh position={[-0.38, 0.1, 1.12]}>
            <boxGeometry args={[0.22, 0.06, 0.02]} />
            <meshStandardMaterial
              color="#BAE6FD"
              emissive="#38BDF8"
              emissiveIntensity={0.9}
            />
          </mesh>
          <mesh position={[0.38, 0.1, 1.12]}>
            <boxGeometry args={[0.22, 0.06, 0.02]} />
            <meshStandardMaterial
              color="#BAE6FD"
              emissive="#38BDF8"
              emissiveIntensity={0.9}
            />
          </mesh>

          {/* Rear LED Light Bar */}
          <mesh position={[0, 0.12, -1.12]}>
            <boxGeometry args={[0.92, 0.05, 0.02]} />
            <meshStandardMaterial
              color="#F87171"
              emissive="#EF4444"
              emissiveIntensity={0.75}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * Autonomous Electric Shuttle Vehicle Gliding Through the Central Guideway
 */
function AutonomousLaneVehicle({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current || reducedMotion) return;
    const t = state.clock.elapsedTime * 0.55;
    ref.current.position.x = Math.sin(t) * 5.1;
  });

  return (
    <group ref={ref} position={[0, 0.24, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.05, 0.3, 1.08]} />
        <meshStandardMaterial
          color="#0052FF"
          metalness={0.75}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.3, 0.22, 0.92]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.12} />
      </mesh>
      {/* Electric-Blue Underglow */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[1.9, 0.02, 0.95]} />
        <meshStandardMaterial
          color="#0052FF"
          emissive="#0052FF"
          emissiveIntensity={0.9}
        />
      </mesh>
    </group>
  );
}

interface SmartParkingCanvasProps {
  slots: ParkingSlot[];
  selectedSlotId?: number | null;
  onSelectSlot?: (slot: ParkingSlot) => void;
  activeFloor?: number;
  heightClass?: string;
}

export function SmartParkingCanvas({
  slots,
  selectedSlotId = null,
  onSelectSlot,
  activeFloor = 1,
  heightClass = "h-[440px]",
}: SmartParkingCanvasProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [fallback2D, setFallback2D] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const floorSlots = useMemo(() => {
    const filtered = slots.filter((s) => s.floor === activeFloor);
    return filtered.length > 0 ? filtered.slice(0, 8) : slots.slice(0, 8);
  }, [slots, activeFloor]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-slate-50 via-white to-blue-50/50 shadow-apple ${heightClass}`}
    >
      {/* Top Overlay Controls & Telemetry HUD */}
      <div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/90 px-3 py-1 text-[11px] font-bold text-brand-600 shadow-sm backdrop-blur-md">
            <Sparkles className="h-3 w-3" />
            3D GARAGE TWIN • FLOOR 0{activeFloor}
          </span>
          <span className="hidden sm:inline-block rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 backdrop-blur-md">
            Mouse Parallax + Interactive Bay Selection
          </span>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setReducedMotion((prev) => !prev)}
            className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:border-brand-300 hover:text-brand-600 backdrop-blur-md transition-colors"
          >
            {reducedMotion ? "Motion: Reduced" : "Motion: Cinematic"}
          </button>
          <button
            type="button"
            onClick={() => setFallback2D((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:border-brand-300 hover:text-brand-600 backdrop-blur-md transition-colors"
          >
            <Eye className="h-3 w-3" />
            <span>{fallback2D ? "3D WebGL View" : "Architectural Fallback"}</span>
          </button>
        </div>
      </div>

      {/* Bottom Legend HUD */}
      <div className="pointer-events-none absolute bottom-3 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2 text-[11px] font-medium text-slate-600 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
            Available Bay
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            EV 50kW Fast-Charge
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Reserved Pass
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            Occupied Vehicle
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">
          Instanced Columns • Electric-Blue Guideway • 60 FPS
        </span>
      </div>

      {/* Accessible Architectural Blueprint Fallback when toggled */}
      {fallback2D ? (
        <div className="flex h-full w-full flex-col justify-center bg-slate-50 px-6 pt-14 pb-14">
          <div className="mx-auto w-full max-w-2xl rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-brand-600" />
                Architectural Deck Blueprint (Floor 0{activeFloor})
              </span>
              <span className="font-mono text-[11px] text-brand-600">
                Reduced-GPU / Accessible Mode
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {floorSlots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSelectSlot?.(slot)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    selectedSlotId === slot.id
                      ? "border-brand-600 bg-brand-600 text-white"
                      : slot.status === "AVAILABLE"
                      ? "border-blue-200 bg-blue-50/50 text-slate-900 hover:border-brand-500"
                      : "border-slate-200 bg-slate-100 text-slate-500"
                  }`}
                >
                  <p className="font-mono text-xs font-extrabold">
                    {slot.slot_number}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold">
                    {slot.status}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Canvas shadows dpr={[1, 2]}>
          <PerspectiveCamera makeDefault position={[0, 9.2, 11.8]} fov={37} />
          <OrbitControls
            enablePan={false}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.25}
            minDistance={7.5}
            maxDistance={16}
          />
          <MouseParallaxRig enabled={!reducedMotion} />

          <ambientLight intensity={0.95} />
          <directionalLight
            position={[9, 15, 11]}
            intensity={1.25}
            castShadow
          />
          <pointLight position={[-4, 3.2, 0]} intensity={0.55} color="#0052FF" />
          <pointLight position={[4, 3.2, 0]} intensity={0.55} color="#0052FF" />

          {/* Lower Concrete Garage Deck Slab */}
          <mesh position={[0, -0.08, 0]} receiveShadow>
            <boxGeometry args={[14.8, 0.16, 9.4]} />
            <meshStandardMaterial color="#E2E8F0" roughness={0.48} />
          </mesh>

          {/* Upper Mezzanine Structural Frame Beams (Electric Blue Accent) */}
          <mesh position={[0, 2.85, -4.1]}>
            <boxGeometry args={[13.6, 0.14, 0.28]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.3} />
          </mesh>
          <mesh position={[0, 2.85, 4.1]}>
            <boxGeometry args={[13.6, 0.14, 0.28]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.3} />
          </mesh>
          <mesh position={[0, 2.76, -4.1]}>
            <boxGeometry args={[13.2, 0.03, 0.08]} />
            <meshStandardMaterial
              color="#0052FF"
              emissive="#0052FF"
              emissiveIntensity={0.85}
            />
          </mesh>
          <mesh position={[0, 2.76, 4.1]}>
            <boxGeometry args={[13.2, 0.03, 0.08]} />
            <meshStandardMaterial
              color="#0052FF"
              emissive="#0052FF"
              emissiveIntensity={0.85}
            />
          </mesh>

          {/* Instanced Structural Columns & Bay Wheel Stops */}
          <InstancedGarageColumns />
          <InstancedWheelStops />

          {/* Central Autonomous Driving Guideway */}
          <mesh position={[0, 0.01, 0]} receiveShadow>
            <boxGeometry args={[14.0, 0.02, 2.35]} />
            <meshStandardMaterial color="#CBD5E1" roughness={0.55} />
          </mesh>

          {/* Electric-Blue Center Guideway Laser Line */}
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[13.2, 0.01, 0.07]} />
            <meshStandardMaterial
              color="#0052FF"
              emissive="#0052FF"
              emissiveIntensity={0.75}
            />
          </mesh>

          {/* Animated Autonomous Shuttle */}
          <AutonomousLaneVehicle reducedMotion={reducedMotion} />

          {/* North Row (4 Marked Bays) */}
          {floorSlots.slice(0, 4).map((slot, index) => {
            const x = -4.5 + index * 3.0;
            return (
              <ParkingBayMesh
                key={slot.id}
                position={[x, 0, -2.65]}
                slot={slot}
                isSelected={selectedSlotId === slot.id}
                reducedMotion={reducedMotion}
                onSelect={onSelectSlot}
              />
            );
          })}

          {/* South Row (4 Marked Bays) */}
          {floorSlots.slice(4, 8).map((slot, index) => {
            const x = -4.5 + index * 3.0;
            return (
              <ParkingBayMesh
                key={slot.id}
                position={[x, 0, 2.65]}
                slot={slot}
                isSelected={selectedSlotId === slot.id}
                reducedMotion={reducedMotion}
                onSelect={onSelectSlot}
              />
            );
          })}

          {/* Floating AI Telemetry Node */}
          <Float
            speed={reducedMotion ? 0 : 2}
            rotationIntensity={reducedMotion ? 0 : 0.25}
            floatIntensity={reducedMotion ? 0 : 0.35}
          >
            <mesh position={[6.3, 1.5, -3.5]}>
              <octahedronGeometry args={[0.3, 0]} />
              <meshStandardMaterial
                color="#0052FF"
                emissive="#0052FF"
                emissiveIntensity={0.6}
                wireframe
              />
            </mesh>
          </Float>
        </Canvas>
      )}
    </div>
  );
}
