# PARKWISE — PHASE 11: INTERACTIVE DRIVER MAP & OUTDOOR NAVIGATION

## 1. Executive Summary & Architecture Overview
Phase 11 introduces an end-to-end geographical discovery, turn-by-turn outdoor navigation, and in-map slot booking experience for drivers on the Parkwise platform. Built with a blend of **Apple-inspired minimalism**, **Tesla-grade telemetry and precision**, and **Stripe-quality components**, drivers can locate facilities, inspect entrance clearances, filter across multiple dimensions, execute instant slot reservations, and navigate to the verified vehicle entrance gate.

```
       +--------------------------------------------------------------------------+
       |                         DRIVER LOCATION DISCOVERY                        |
       |       GPS / Geolocation Beacon (±35m) <---> Transit Hub Search Bar       |
       +--------------------------------------------------------------------------+
                                            |
                                            v
       +--------------------------------------------------------------------------+
       |                      INTERACTIVE MAP & VIEW MODES                        |
       |  - Parkwise Electric Blue Markers & Live Free Bay Counter (e.g. 185/450) |
       |  - Spatial Marker Clustering (Zoom <= 12: Hub Count & Price Badges)      |
       |  - Dual Layout: High-Definition Vector Map <---> Structured List View    |
       |  - Light (Apple Minimal) & Dark (Tesla Cinematic) Tile Canvas Themes    |
       +--------------------------------------------------------------------------+
                                            |
                                            v
       +--------------------------------------------------------------------------+
       |                  MULTI-DIMENSIONAL PARKING FILTERS                       |
       |  - Distance Slider (1-30 km)     - Max Hourly Tariff (₹40 - ₹200)        |
       |  - Available Now Only            - Covered Parking Bays Only             |
       |  - 60kW EV HyperCharging Bays    - Accessible (Divyang) Parking Bays     |
       |  - 24/7 Open Schedule            - Vehicle Compatibility (SUV/Sedan/EV)  |
       |  - Sorting: Closest Distance, Price: Low to High, Most Available Bays    |
       +--------------------------------------------------------------------------+
                      |                                            |
                      v                                            v
       +-------------------------------+            +-------------------------------+
       |    OUTDOOR NAVIGATION ENGINE  |            |   IN-MAP DIRECT SLOT BOOKING  |
       |  - Turn-by-Turn Route Guidance|            |  - Pre-Booking Capacity Check |
       |  - Target: Exact Vehicle Gate |            |  - Slot & Floor Allocation    |
       |  - Realistic Road Waypoints   |            |  - Tariff & EV Addon Billing  |
       |  - Alternative Route Options  |            |  - Instant Cryptographic QR   |
       |  - Google / Apple / Waze Deep |            |  - Seamless Navigation Launch |
       +-------------------------------+            +-------------------------------+
```

---

## 2. Interactive Map & Spatial Clustering Engine
- **Spatial Clustering**: At zoom levels $\le 12$, proximate parking facilities are aggregated into cluster centroids calculated via geodesic Haversine distance, displaying total facility count, starting hourly price, and cumulative available bays. Clicking any cluster zooms into that specific hub cluster.
- **Custom Parkwise Electric Blue Markers**: Custom markers render the facility name, starting hourly tariff (`₹80/h`), available bay badge, and color-coded status (Emerald for available, Rose for 100% full capacity).
- **Driver GPS Beacon & Accuracy Halo**: Displays real-time device location with an animated pulsing beacon and a calibrated radius circle representing GPS accuracy in meters.
- **Map / List View Toggle**: Seamless one-click switching between full-screen vector canvas and structured list view with detailed facility cards.

---

## 3. Outdoor Navigation & Turn-by-Turn Guidance
- **Entrance-Targeted Routing**: Unlike consumer maps that navigate to building center points, Parkwise specifically routes drivers to the **verified vehicle ingress barrier** (`FacilityEntrance`), preventing drivers from circling busy commercial complexes.
- **Route Calculation API**:
  `GET /api/parking/facilities/{id}/route?origin_lat={lat}&origin_lng={lng}&entrance_id={id}`
  Returns:
  - `distance_km`: Driving road distance with urban circuity factor.
  - `duration_minutes`: Estimated driving time adjusted for traffic speed.
  - `waypoints`: Array of realistic road coordinates with natural curvature.
  - `steps`: Step-by-step driving maneuvers with distance, street names, and entrance gate clearance notes.
  - `alternative_routes`: 1-2 alternate routes with time differential and distance comparison.
  - `external_links`: Deep links to Google Maps, Apple Maps, and Waze.
- **In-App Navigation HUD**:
  When active, displays a floating Tesla-style HUD with next turn maneuver icon, distance countdown, street name, ETA, and entrance gate clearance badge.

---

## 4. In-Map Direct Booking Integration
- **Zero-Redirect Booking Flow**: Drivers can reserve a parking space directly from the map or list view without losing their spatial context.
- **Concurrency & Availability Validation**: Confirms real-time bay availability before processing (`HTTP 409 Conflict` if facility reaches capacity).
- **Atomic Slot & Floor Allocation**: Allocates specific bay codes (e.g. `Slot B1-14 (Level B1 - Indoor Guidance Ready)`) and decrements available capacity atomically in the database.
- **Instant Digital Pass**: Issues a unique `booking_reference` (e.g. `PW-MAP-A1B2`) and cryptographic QR entry token (`QR-PW-...`) for contact-free entry.
- **Post-Booking Action Launch**: Drivers can immediately transition into turn-by-turn navigation or launch external navigation apps.

---

## 5. API Endpoints Reference
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/parking/facilities/{id}/route` | Calculates turn-by-turn outdoor driving route to verified entrance gate |
| `GET` | `/api/parking/facilities/clusters` | Spatially clusters facility pins based on current zoom level |
| `POST` | `/api/parking/facilities/{id}/book` | Directly books a parking slot from the map with live slot assignment |
| `GET` | `/api/parking/facilities/{id}/availability` | Real-time breakdown of slot availability by vehicle and EV charger type |
| `GET` | `/api/parking/facilities/nearby` | Enhanced radius search with distance, price, amenity, and sorting filters |
| `GET` | `/api/parking/places/search` | Search autocomplete for Indian transit hubs and commercial centers |
| `GET` | `/api/parking/places/reverse-geocode` | Reverse geocodes coordinates to approximate Indian address |

---

## 6. Automated Test Coverage
All 39 automated tests across Phases 08, 09, 10, and 11 passed 100%:
- `test_01_outdoor_route_calculation_to_entrance`
- `test_02_route_step_guidance_and_maneuvers`
- `test_03_map_marker_spatial_clustering`
- `test_04_direct_facility_booking_from_map`
- `test_05_facility_availability_breakdown`
- `test_06_booking_overcapacity_conflict`
- `test_07_missing_facility_route_404`
- Full regression across all modules.
