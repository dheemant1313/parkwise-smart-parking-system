# PARKWISE — PHASE 10: MAP FOUNDATION & LOCATION INFRASTRUCTURE
**Document Version:** 1.0.0  
**Phase:** 10 (Map Provider Integration, Facility Database, Location Services & Entrance Navigation)  
**Status:** ✅ **COMPLETED & TESTED (100% Test Pass Rate)**  

---

## 1. ARCHITECTURAL OVERVIEW

Phase 10 provides the geographical foundation of Parkwise, enabling drivers to discover smart parking facilities, inspect their precise coordinates and entrance waypoints, and navigate directly to the correct entrance gate:

```
[ Driver GPS / Search Query ]
             │
             ▼
┌──────────────────────────────────────────────┐
│        Nearby Discovery & Geodesic Engine    │
│ (Bounding Box Filter + Haversine Distance)   │
└──────────────────────┬───────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ Parking Facility Record │  │ Dedicated Entrance Gate  │
│ (Address, Hours, Rates) │  │ (Clearance, Barrier Type)│
└─────────────────────────┘  └─────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│          Interactive Map Visualizer          │
│ (Mapbox GL / Google Maps / OSM Vector Tiles) │
└──────────────────────────────────────────────┘
```

---

## 2. MAP PROVIDER INTEGRATION ARCHITECTURE

Parkwise implements a flexible, multi-provider map foundation designed for high reliability across desktop, tablet, and mobile devices:

### A. Environment Configuration & Domain Restrictions
API keys are managed strictly via environment variables:
```bash
# Provider Selection: mapbox | google_maps | osm
NEXT_PUBLIC_MAP_PROVIDER=mapbox

# Mapbox GL Access Token (Restricted to https://parkwise.in/*)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoicGFya3dpc2UiLC...

# Google Maps JavaScript API Key (Restricted to HTTP referrers)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
```

### B. High-Definition Vector Tile Canvas Fallback
When external commercial API keys are not supplied (or during offline / low-connectivity situations), Parkwise automatically activates its built-in Vector Tile Canvas Engine:
- **Zero Third-Party Dependency:** Renders interactive coordinates, spatial grids, and OpenStreetMap raster/vector tiles.
- **Full Touch & Mouse Gestures:** Smooth pan dragging, wheel zoom (levels 10 to 19), center recalibration, and tile mode toggling (Standard, Dark, Satellite).
- **Graceful Error & Loading States:** Features skeleton overlays during network queries and non-blocking retry mechanisms.

---

## 3. PARKING FACILITY DATABASE MODELS

Seven normalized database models were architected in `backend/app/models_facility.py`:

| Model | Primary Purpose | Key Fields |
|:---|:---|:---|
| **`ParkingFacility`** | Main facility entity | `code`, `name`, `slug`, `category`, `status`, `total_capacity`, `available_capacity`, `base_hourly_rate_inr`, `is_24_hours`, `supported_vehicle_types`, `amenities`, `photos` |
| **`FacilityLocation`** | Precise coordinates & spatial metadata | `latitude`, `longitude`, `altitude_meters`, `geohash`, `bounding_box_ne_lat/lng`, `bounding_box_sw_lat/lng`, `place_id`, `plus_code` |
| **`FacilityAddress`** | Postal and landmark identification | `street_line1`, `street_line2`, `locality`, `city`, `state`, `postal_code`, `landmark`, `formatted_address` |
| **`FacilityEntrance`** | Dedicated vehicular entrance gates | `gate_name`, `gate_code`, `latitude`, `longitude`, `height_clearance_meters`, `barrier_type`, `allowed_vehicle_types`, `turn_restrictions`, `navigation_waypoint_notes`, `is_primary` |
| **`FacilityExit`** | Dedicated vehicular exit gates | `gate_name`, `gate_code`, `latitude`, `longitude`, `barrier_type`, `merge_instructions` |
| **`FacilityOperatingHours`** | Day-of-week schedules | `day_of_week` (0-6), `open_time`, `close_time`, `is_24_hours`, `is_closed` |
| **`FacilityMapConfiguration`** | Map provider styling & 3D floor config | `map_provider`, `default_zoom_level`, `pitch_degrees`, `bearing_degrees`, `style_url`, `has_indoor_3d_tiles`, `indoor_levels_json` |

---

## 4. LOCATION SERVICES & GEODESIC GEOMETRY

Located in `backend/app/services/location_service.py`:

1. **Haversine Distance Engine:**
   - Computes great-circle distance between two geographic coordinates:
     $$\Delta\sigma = 2 \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
     $$d = R \cdot \Delta\sigma \quad (R = 6371\text{ km})$$
   - Computes exact distance in both kilometers and meters.
2. **Geohash Encoding:**
   - Standard 32-bit Base32 geohash encoding generating 8-character spatial hashes for clustering.
3. **Axis-Aligned Bounding Box (AABB):**
   - Automatically computes latitude and longitude boundaries given a search point and radius ($r$ km), filtering candidates in the SQL query before performing trigonometric computations.
4. **Place & Address Autocomplete Catalog:**
   - Pre-indexed high-precision coordinates for major Indian commercial and transit hubs (Connaught Place, DLF CyberHub, BKC Mumbai, Indiranagar Bengaluru, HITEC City Hyderabad, IGI Airport T3, etc.).
5. **Reverse Geocoding:**
   - Resolves latitude and longitude coordinates into the nearest Indian landmark and locality.

---

## 5. BACKEND API ENDPOINTS

Available under both `/api/v1/parking/*` and `/api/parking/*`:

| Method | Endpoint | Query Parameters | Description |
|:---|:---|:---|:---|
| **GET** | `/api/parking/facilities` | `city`, `category`, `status`, `skip`, `limit` | Lists parking facilities with filtering |
| **GET** | `/api/parking/facilities/nearby` | `latitude`, `longitude`, `radius_km`, `vehicle_type`, `max_price`, `available_only`, `category` | Radius search sorted by distance |
| **GET** | `/api/parking/facilities/{id}` | - | Complete facility detail with address & hours |
| **GET** | `/api/parking/facilities/{id}/location` | - | Precise coordinates, bounding box & map config |
| **GET** | `/api/parking/facilities/{id}/entrances` | - | Dedicated entrance & exit gates with clearances |
| **GET** | `/api/parking/places/search` | `query`, `limit` | Fuzzy place & landmark autocomplete |
| **GET** | `/api/parking/places/reverse-geocode` | `latitude`, `longitude` | Converts lat/lng into address & landmark |

---

## 6. FRONTEND COMPONENTS & DRIVER EXPERIENCE

- **`ParkingMapView` (`frontend/src/components/map/ParkingMapView.tsx`):**
  - Responsive full-screen map view with pan, zoom, dark/satellite tile toggling, and coordinate telemetry.
  - Interactive facility pins with real-time capacity count and availability indicators (green/amber/red).
  - Dedicated entrance gate markers with height clearance flags.
  - User location beacon with pulsing GPS accuracy ring.
  - Animated dashed route line connecting driver position to the assigned facility entrance gate.
- **`FacilityCardDrawer` (`frontend/src/components/map/FacilityCardDrawer.tsx`):**
  - Floating card displaying facility photo, live bay availability bar, hourly tariff, driving ETA, entrance details, and one-click deep links to Google Maps / Apple Maps navigation.
- **`LocationSearchBar` (`frontend/src/components/map/LocationSearchBar.tsx`):**
  - Autocomplete search with instant debounce, Indian transit hub suggestions, and one-click GPS geolocation detection (`navigator.geolocation`).
- **`MapFilterBar` (`frontend/src/components/map/MapFilterBar.tsx`):**
  - Interactive radius slider (1–30 km), vehicle type selector (EV, SUV, Sedan, 2-Wheeler), category pills, and availability toggles.
- **`DriverMapPage` (`frontend/src/app/driver/map/page.tsx`):**
  - Standalone map page protected by `<ProtectedRouteGate allowedRoles={["DRIVER", "ADMIN"]}>`.

---

## 7. AUTOMATED TEST VERIFICATION

Automated tests in `backend/tests/test_phase10_map_and_facilities.py` passed 100%:

```
tests/test_phase10_map_and_facilities.py:
  test_01_facility_models_and_seeding                 PASSED [11%]
  test_02_get_all_facilities_with_filters             PASSED [22%]
  test_03_nearby_discovery_and_distance_sorting       PASSED [33%]
  test_04_radius_and_price_and_vehicle_filters       PASSED [44%]
  test_05_facility_details_and_location_endpoints     PASSED [55%]
  test_06_facility_entrances_and_navigation_waypoints PASSED [66%]
  test_07_places_search_and_reverse_geocoding         PASSED [77%]
  test_08_geodesic_haversine_math_and_geohash         PASSED [88%]
  test_09_missing_facility_404_error_handling         PASSED [100%]
============================== 9 passed in 2.93s ==============================
```
