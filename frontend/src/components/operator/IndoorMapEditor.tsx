"use client";

import React, { useEffect, useState } from "react";
import {
  Layers,
  MapPin,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Lock,
  Unlock,
  Upload,
  Info,
  Sliders,
  Sparkles,
} from "lucide-react";
import {
  fetchFacilityIndoorMap,
  toggleLaneBlocked,
  validateAndPublishMap,
  FacilityFloorMapResponse,
  FloorMapLayerItem,
  MapEdgeItem,
  MapNodeItem,
  MapValidationReport,
} from "@/lib/indoorNavigationApi";

interface IndoorMapEditorProps {
  facilityId?: number;
}

export default function IndoorMapEditor({ facilityId = 1 }: IndoorMapEditorProps) {
  const [mapData, setMapData] = useState<FacilityFloorMapResponse | null>(null);
  const [activeFloorLevel, setActiveFloorLevel] = useState<number>(0);
  const [selectedEdge, setSelectedEdge] = useState<MapEdgeItem | null>(null);
  const [selectedNode, setSelectedNode] = useState<MapNodeItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [validationReport, setValidationReport] = useState<MapValidationReport | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load Map Data
  const loadMap = async () => {
    try {
      setLoading(true);
      const data = await fetchFacilityIndoorMap(facilityId);
      setMapData(data);
      setLoading(false);
    } catch (err: any) {
      console.error("Failed to load map data:", err);
      setToastMessage(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMap();
  }, [facilityId]);

  const currentFloor: FloorMapLayerItem | undefined = mapData?.floors.find(
    (f) => f.floor_level === activeFloorLevel
  );

  // Toggle Lane Blocked State
  const handleToggleLaneBlock = async (edge: MapEdgeItem) => {
    try {
      const reason = edge.is_blocked
        ? undefined
        : prompt("Enter reason for lane closure:", "Routine maintenance / surface cleaning") || "Temporary roadwork";

      const updatedEdge = await toggleLaneBlocked(facilityId, edge.id, reason);
      setToastMessage(
        updatedEdge.is_blocked
          ? `Lane ${edge.id} closed (${updatedEdge.block_reason || "Blocked"}). Vehicles rerouted.`
          : `Lane ${edge.id} reopened for traffic.`
      );
      setSelectedEdge(updatedEdge);
      loadMap();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage(`Failed to toggle lane state: ${err.message}`);
    }
  };

  // Validate & Publish Map
  const handleValidateAndPublish = async () => {
    try {
      setIsPublishing(true);
      const nextVer = `v1.${(mapData?.floors.length || 3) + 1}.0`;
      const report = await validateAndPublishMap(facilityId, nextVer, "Published via Operator Editor Console");
      setValidationReport(report);
      setIsPublishing(false);
      if (report.is_valid) {
        setToastMessage(`Map successfully validated & published as ${nextVer}! (Connectivity: ${(report.connectivity_score * 100).toFixed(0)}%)`);
        loadMap();
      } else {
        setToastMessage(`Validation Failed: ${report.errors.join(", ")}`);
      }
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      setIsPublishing(false);
      setToastMessage(`Publish failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl text-white">
        <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading facility indoor map layers and topology...</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-950 text-slate-100 rounded-3xl border border-slate-800/80 overflow-hidden shadow-2xl">
      {/* Editor Header */}
      <div className="p-6 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              OPERATOR INDOOR MAP STUDIO
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Version: {mapData?.current_map_version || "v1.4.0"}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            {mapData?.facility_name || "Multilevel Smart Garage"}
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadMap}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Reload Map Layers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleValidateAndPublish}
            disabled={isPublishing}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2"
          >
            {isPublishing ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-4 h-4 fill-current" />
            )}
            <span>Validate & Publish Version</span>
          </button>
        </div>
      </div>

      {/* Editor Toast Notice */}
      {toastMessage && (
        <div className="mx-6 mt-4 p-3 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-medium flex items-center gap-2 animate-fadeIn">
          <Info className="w-4 h-4 shrink-0 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Grid: SVG Visualizer + Layer Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Visual Map Canvas */}
        <div className="lg:col-span-8 p-6 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between">
          {/* Floor Level Filter Tabs */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-2xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 px-3">Floors:</span>
              {mapData?.floors.map((fl) => (
                <button
                  key={fl.floor_level}
                  onClick={() => {
                    setActiveFloorLevel(fl.floor_level);
                    setSelectedEdge(null);
                    setSelectedNode(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    activeFloorLevel === fl.floor_level
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {fl.floor_level === 0 ? "Ground (G)" : `B${Math.abs(fl.floor_level)}`}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400">
              Click any lane or node to inspect & manage
            </div>
          </div>

          {/* SVG Visualizer */}
          <div className="w-full aspect-[16/10] bg-slate-900/60 rounded-2xl border border-slate-800 relative overflow-hidden flex items-center justify-center p-2 shadow-inner">
            <svg viewBox="0 0 260 200" className="w-full h-full select-none">
              {/* Background Grid */}
              <pattern id="editorGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
              <rect width="260" height="200" fill="url(#editorGrid)" />

              {/* Driving Lanes (Edges) */}
              {currentFloor?.edges.map((edge) => {
                const fromNode = currentFloor.nodes.find((n) => n.id === edge.from_node_id);
                const toNode = currentFloor.nodes.find((n) => n.id === edge.to_node_id);
                if (!fromNode || !toNode) return null;

                const isSelected = selectedEdge?.id === edge.id;
                const isBlocked = edge.is_blocked;

                return (
                  <g
                    key={edge.id}
                    className="cursor-pointer group"
                    onClick={() => {
                      setSelectedEdge(edge);
                      setSelectedNode(null);
                    }}
                  >
                    <line
                      x1={fromNode.x_coord}
                      y1={fromNode.y_coord}
                      x2={toNode.x_coord}
                      y2={toNode.y_coord}
                      stroke={isSelected ? "#00E5FF" : isBlocked ? "#ef4444" : "#475569"}
                      strokeWidth={isSelected ? "5" : "3.5"}
                      strokeDasharray={edge.edge_type === "RAMP_TRANSITION" ? "3,3" : undefined}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}

              {/* Nodes */}
              {currentFloor?.nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isSlot = node.slot_number !== null;
                const isRamp = node.node_type.includes("RAMP");

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x_coord}, ${node.y_coord})`}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedNode(node);
                      setSelectedEdge(null);
                    }}
                  >
                    <circle
                      r={isSelected ? "8" : isSlot ? "6" : isRamp ? "5" : "3.5"}
                      fill={
                        isSelected
                          ? "#00E5FF"
                          : isSlot
                          ? "#0284C7"
                          : isRamp
                          ? "#f59e0b"
                          : "#334155"
                      }
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y={-8}
                      fill={isSelected ? "#00E5FF" : "#94a3b8"}
                      fontSize="5"
                      fontWeight={isSelected ? "bold" : "normal"}
                      textAnchor="middle"
                    >
                      {node.slot_number || node.node_code}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Stats Bar */}
          <div className="w-full mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Level: <strong className="text-white">{currentFloor?.floor_name}</strong> • Total Nodes:{" "}
              <strong className="text-white">{currentFloor?.nodes.length}</strong> • Lanes:{" "}
              <strong className="text-white">{currentFloor?.edges.length}</strong>
            </div>
            <div>
              Mapped Slots: <strong className="text-cyan-400">{currentFloor?.slots.length}</strong>
            </div>
          </div>
        </div>

        {/* Right Inspector & Operations Panel */}
        <div className="lg:col-span-4 p-6 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inspector & Lane Operations</span>
            </h3>

            {/* Edge / Lane Selected */}
            {selectedEdge ? (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Lane Segment #{selectedEdge.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedEdge.is_blocked
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {selectedEdge.is_blocked ? "BLOCKED / CLOSED" : "OPEN / ACTIVE"}
                  </span>
                </div>

                <div className="text-xs space-y-1.5 text-slate-400">
                  <div className="flex justify-between">
                    <span>Edge Type:</span>
                    <span className="font-semibold text-slate-200">{selectedEdge.edge_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Length:</span>
                    <span className="font-semibold text-slate-200">{selectedEdge.length_meters} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Speed Limit:</span>
                    <span className="font-semibold text-slate-200">{selectedEdge.speed_limit_kmh} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>One-Way:</span>
                    <span className="font-semibold text-slate-200">{selectedEdge.is_one_way ? "Yes" : "No (Bi-directional)"}</span>
                  </div>
                  {selectedEdge.is_blocked && (
                    <div className="pt-2 border-t border-slate-800 text-rose-400">
                      <span>Block Reason: </span>
                      <strong>{selectedEdge.block_reason || "Hazard"}</strong>
                    </div>
                  )}
                </div>

                {/* Block / Unblock Toggle Button */}
                <button
                  onClick={() => handleToggleLaneBlock(selectedEdge)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                    selectedEdge.is_blocked
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                      : "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40"
                  }`}
                >
                  {selectedEdge.is_blocked ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Reopen Lane Segment</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Block Lane (Roadwork / Spill)</span>
                    </>
                  )}
                </button>
              </div>
            ) : selectedNode ? (
              /* Node Selected */
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Node: {selectedNode.node_code}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                    {selectedNode.node_type}
                  </span>
                </div>

                <div className="text-xs space-y-1.5 text-slate-400">
                  <div className="flex justify-between">
                    <span>Coordinates (X, Y):</span>
                    <span className="font-mono text-slate-200">({selectedNode.x_coord}, {selectedNode.y_coord})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Floor:</span>
                    <span className="font-semibold text-slate-200">{selectedNode.floor_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Zone:</span>
                    <span className="font-semibold text-cyan-400">{selectedNode.zone_code || "N/A"}</span>
                  </div>
                  {selectedNode.slot_number && (
                    <div className="flex justify-between pt-1 border-t border-slate-800">
                      <span>Assigned Slot Number:</span>
                      <strong className="text-cyan-300">{selectedNode.slot_number}</strong>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-slate-400 text-xs">
                Select a lane or node on the map to modify settings or toggle temporary closures.
              </div>
            )}

            {/* Validation Report Widget */}
            {validationReport && (
              <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Graph Validation</span>
                  </span>
                  <span className="text-xs font-extrabold text-cyan-400">
                    {(validationReport.connectivity_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Connectivity validated across all 4 garage levels. Disconnected nodes:{" "}
                  <strong>{validationReport.disconnected_node_codes.length}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Security Info */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Map edits are audited with operator digital signature.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
