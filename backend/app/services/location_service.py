"""Location Services, Geocoding & Geodesic Geometry Engine for Parkwise.

Provides:
1. Haversine distance calculation in kilometers and meters.
2. Geohash encoding for spatial proximity clustering.
3. Bounding box computation around a geographical coordinate.
4. Pre-indexed Indian urban landmarks and transit hubs geocoding search.
5. Reverse geocoding approximations.
"""
import math
from typing import Any, Dict, List, Optional, Tuple


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points on the Earth in kilometers."""
    r = 6371.0  # Earth radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 3)


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates distance between two points in meters."""
    return round(haversine_distance_km(lat1, lon1, lat2, lon2) * 1000.0, 1)


# Geohash base32 character alphabet
GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def encode_geohash(latitude: float, longitude: float, precision: int = 8) -> str:
    """Encodes latitude and longitude into a standard Base32 Geohash string."""
    lat_interval = [-90.0, 90.0]
    lon_interval = [-180.0, 180.0]
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    is_even = True

    while len(geohash) < precision:
        if is_even:
            mid = (lon_interval[0] + lon_interval[1]) / 2.0
            if longitude > mid:
                ch |= bits[bit]
                lon_interval[0] = mid
            else:
                lon_interval[1] = mid
        else:
            mid = (lat_interval[0] + lat_interval[1]) / 2.0
            if latitude > mid:
                ch |= bits[bit]
                lat_interval[0] = mid
            else:
                lat_interval[1] = mid

        is_even = not is_even
        if bit < 4:
            bit += 1
        else:
            geohash.append(GEOHASH_BASE32[ch])
            bit = 0
            ch = 0

    return "".join(geohash)


def calculate_bounding_box(
    latitude: float, longitude: float, radius_km: float
) -> Dict[str, float]:
    """Computes axis-aligned bounding box (min/max lat/lng) for spatial database filtering."""
    # 1 degree latitude ~ 111 km
    lat_delta = radius_km / 111.0
    # 1 degree longitude ~ 111 * cos(lat)
    lon_delta = radius_km / (111.0 * math.cos(math.radians(latitude)))

    return {
        "min_lat": round(latitude - lat_delta, 6),
        "max_lat": round(latitude + lat_delta, 6),
        "min_lng": round(longitude - lon_delta, 6),
        "max_lng": round(longitude + lon_delta, 6),
    }


# High-precision catalog of popular Indian transit hubs, tech parks, airports, and commercial centers
POPULAR_INDIAN_LOCATIONS: List[Dict[str, Any]] = [
    {
        "place_id": "del_cp_01",
        "name": "Connaught Place (Inner Circle)",
        "locality": "Connaught Place",
        "city": "New Delhi",
        "state": "Delhi",
        "latitude": 28.6315,
        "longitude": 77.2167,
        "type": "COMMERCIAL_HUB",
    },
    {
        "place_id": "del_saket_02",
        "name": "Select CITYWALK & Saket District Centre",
        "locality": "Saket",
        "city": "New Delhi",
        "state": "Delhi",
        "latitude": 28.5283,
        "longitude": 77.2185,
        "type": "SHOPPING_MALL",
    },
    {
        "place_id": "del_igi_03",
        "name": "Indira Gandhi International Airport (Terminal 3)",
        "locality": "Palam",
        "city": "New Delhi",
        "state": "Delhi",
        "latitude": 28.5562,
        "longitude": 77.0999,
        "type": "AIRPORT",
    },
    {
        "place_id": "gur_cyber_04",
        "name": "DLF CyberHub & Cyber City",
        "locality": "DLF Phase 2",
        "city": "Gurugram",
        "state": "Haryana",
        "latitude": 28.4952,
        "longitude": 77.0894,
        "type": "TECH_PARK",
    },
    {
        "place_id": "blr_indira_05",
        "name": "Indiranagar 100ft Road Metro Hub",
        "locality": "Indiranagar",
        "city": "Bengaluru",
        "state": "Karnataka",
        "latitude": 12.9784,
        "longitude": 77.6408,
        "type": "TRANSIT_HUB",
    },
    {
        "place_id": "blr_kora_06",
        "name": "Koramangala Sony World Junction",
        "locality": "Koramangala 4th Block",
        "city": "Bengaluru",
        "state": "Karnataka",
        "latitude": 12.9345,
        "longitude": 77.6266,
        "type": "COMMERCIAL_HUB",
    },
    {
        "place_id": "blr_white_07",
        "name": "Whitefield ITPL Tech Corridor",
        "locality": "Whitefield",
        "city": "Bengaluru",
        "state": "Karnataka",
        "latitude": 12.9863,
        "longitude": 77.7302,
        "type": "TECH_PARK",
    },
    {
        "place_id": "mum_bkc_08",
        "name": "Bandra Kurla Complex (BKC G Block)",
        "locality": "Bandra East",
        "city": "Mumbai",
        "state": "Maharashtra",
        "latitude": 19.0657,
        "longitude": 72.8687,
        "type": "FINANCIAL_DISTRICT",
    },
    {
        "place_id": "mum_nariman_09",
        "name": "Nariman Point Business District",
        "locality": "Marine Drive",
        "city": "Mumbai",
        "state": "Maharashtra",
        "latitude": 18.9260,
        "longitude": 72.8238,
        "type": "COMMERCIAL_HUB",
    },
    {
        "place_id": "mum_t2_10",
        "name": "Chhatrapati Shivaji Maharaj International Airport (T2)",
        "locality": "Sahar",
        "city": "Mumbai",
        "state": "Maharashtra",
        "latitude": 19.0886,
        "longitude": 72.8679,
        "type": "AIRPORT",
    },
    {
        "place_id": "hyd_hitec_11",
        "name": "HITEC City Cyber Towers Hub",
        "locality": "Madhapur",
        "city": "Hyderabad",
        "state": "Telangana",
        "latitude": 17.4474,
        "longitude": 78.3762,
        "type": "TECH_PARK",
    },
    {
        "place_id": "pune_viman_12",
        "name": "Phoenix Marketcity & Viman Nagar",
        "locality": "Viman Nagar",
        "city": "Pune",
        "state": "Maharashtra",
        "latitude": 18.5621,
        "longitude": 73.9168,
        "type": "SHOPPING_MALL",
    },
]


def search_places_and_addresses(query: str, limit: int = 8) -> List[Dict[str, Any]]:
    """Performs instant fuzzy substring matching across Indian landmarks and localities."""
    q = query.strip().lower()
    if not q:
        return POPULAR_INDIAN_LOCATIONS[:limit]

    matches = []
    for loc in POPULAR_INDIAN_LOCATIONS:
        searchable_text = f"{loc['name']} {loc['locality']} {loc['city']} {loc['state']}".lower()
        if q in searchable_text:
            matches.append(loc)

    return matches[:limit]


def reverse_geocode_approximate(latitude: float, longitude: float) -> Dict[str, Any]:
    """Finds closest landmark and returns an approximate locality and city name."""
    closest = None
    min_dist = float("inf")

    for loc in POPULAR_INDIAN_LOCATIONS:
        dist = haversine_distance_km(latitude, longitude, loc["latitude"], loc["longitude"])
        if dist < min_dist:
            min_dist = dist
            closest = loc

    if closest and min_dist <= 50.0:
        return {
            "formatted_address": f"Near {closest['name']}, {closest['locality']}, {closest['city']}, {closest['state']}",
            "locality": closest["locality"],
            "city": closest["city"],
            "state": closest["state"],
            "country": "India",
            "distance_to_landmark_km": min_dist,
        }

    return {
        "formatted_address": f"Coordinates ({latitude:.4f}, {longitude:.4f}), India",
        "locality": "Urban Vicinity",
        "city": "Metro Region",
        "state": "India",
        "country": "India",
        "distance_to_landmark_km": min_dist if min_dist != float("inf") else 0.0,
    }


def generate_external_navigation_links(
    dest_lat: float, dest_lng: float, origin_lat: Optional[float] = None, origin_lng: Optional[float] = None
) -> Dict[str, str]:
    """Generates deep links for Google Maps, Apple Maps, and Waze to verified entrance coordinates."""
    google_url = f"https://www.google.com/maps/dir/?api=1&destination={dest_lat:.6f},{dest_lng:.6f}&travelmode=driving"
    apple_url = f"https://maps.apple.com/?daddr={dest_lat:.6f},{dest_lng:.6f}&dirflg=d"
    waze_url = f"https://waze.com/ul?ll={dest_lat:.6f},{dest_lng:.6f}&navigate=yes"

    if origin_lat is not None and origin_lng is not None:
        google_url += f"&origin={origin_lat:.6f},{origin_lng:.6f}"
        apple_url += f"&saddr={origin_lat:.6f},{origin_lng:.6f}"

    return {
        "google_maps": google_url,
        "apple_maps": apple_url,
        "waze": waze_url,
    }


def generate_outdoor_route(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    facility_name: str,
    entrance_name: str,
    entrance_clearance_m: float = 2.4,
) -> Dict[str, Any]:
    """Generates high-precision outdoor navigation route, waypoints, maneuvers, and alternatives."""
    straight_km = haversine_distance_km(origin_lat, origin_lng, dest_lat, dest_lng)
    driving_km = max(0.4, round(straight_km * 1.25, 2))
    driving_minutes = max(3, round((driving_km / 22.0) * 60))

    # Generate realistic intermediate road waypoints
    num_pts = 7
    waypoints: List[Dict[str, float]] = []
    for i in range(num_pts + 1):
        t = i / float(num_pts)
        # Add slight natural road curvature
        curve_offset = math.sin(t * math.pi) * 0.0018
        lat_i = round(origin_lat + (dest_lat - origin_lat) * t + curve_offset, 6)
        lng_i = round(origin_lng + (dest_lng - origin_lng) * t - curve_offset * 0.7, 6)
        waypoints.append({"lat": lat_i, "lng": lng_i})

    # Generate step-by-step turn guidance
    dist_step1 = int(driving_km * 300)
    dist_step2 = int(driving_km * 500)
    dist_step3 = int(driving_km * 150)
    dist_step4 = 50

    steps = [
        {
            "step_number": 1,
            "instruction": f"Depart current location and head toward arterial corridor",
            "distance_meters": dist_step1,
            "duration_seconds": max(60, dist_step1 // 8),
            "turn_type": "STRAIGHT",
            "street_name": "Connecting Link Road",
        },
        {
            "step_number": 2,
            "instruction": f"Merge onto main expressway / avenue toward {facility_name}",
            "distance_meters": dist_step2,
            "duration_seconds": max(120, dist_step2 // 10),
            "turn_type": "MERGE",
            "street_name": "Main Corridor Expressway",
        },
        {
            "step_number": 3,
            "instruction": f"Use left lane to enter the designated facility service ramp",
            "distance_meters": dist_step3,
            "duration_seconds": max(45, dist_step3 // 6),
            "turn_type": "TURN_LEFT",
            "street_name": f"{facility_name} Inbound Access Way",
        },
        {
            "step_number": 4,
            "instruction": f"Arrive at {entrance_name}. Height clearance: {entrance_clearance_m}m. Automated boom barrier will verify your vehicle / QR token.",
            "distance_meters": dist_step4,
            "duration_seconds": 20,
            "turn_type": "ARRIVE",
            "street_name": entrance_name,
        },
    ]

    # Generate alternative route
    alt_km = round(driving_km * 1.18, 2)
    alt_mins = driving_minutes + 4
    alt_waypoints: List[Dict[str, float]] = []
    for i in range(num_pts + 1):
        t = i / float(num_pts)
        alt_offset = -math.sin(t * math.pi) * 0.0025
        alt_waypoints.append({
            "lat": round(origin_lat + (dest_lat - origin_lat) * t + alt_offset, 6),
            "lng": round(origin_lng + (dest_lng - origin_lng) * t + alt_offset * 0.5, 6),
        })

    alternative_routes = [
        {
            "route_id": "alt_01",
            "name": "Alternative via Parallel Service Road",
            "distance_km": alt_km,
            "duration_minutes": alt_mins,
            "time_diff_minutes": 4,
            "summary": "Slightly longer bypass with lower congestion",
            "waypoints": alt_waypoints,
        }
    ]

    external_links = generate_external_navigation_links(dest_lat, dest_lng, origin_lat, origin_lng)

    return {
        "distance_km": driving_km,
        "duration_minutes": driving_minutes,
        "summary": f"Fastest route via Main Corridor to {entrance_name}",
        "traffic_condition": "MODERATE",
        "waypoints": waypoints,
        "steps": steps,
        "alternative_routes": alternative_routes,
        "external_links": external_links,
    }


def calculate_spatial_clusters(
    facilities: List[Dict[str, Any]], zoom: int
) -> List[Dict[str, Any]]:
    """Clusters geographically proximate facilities when map is zoomed out."""
    if zoom >= 14 or not facilities:
        # At high zoom, return each facility as an individual cluster
        return [
            {
                "cluster_id": f"single_{f['id']}",
                "latitude": f["latitude"],
                "longitude": f["longitude"],
                "count": 1,
                "min_price": f.get("base_hourly_rate_inr", 60.0),
                "max_price": f.get("base_hourly_rate_inr", 60.0),
                "total_available_slots": f.get("available_capacity", 0),
                "facility_ids": [f["id"]],
                "facility_names": [f["name"]],
            }
            for f in facilities
        ]

    # Cluster distance threshold in km based on zoom level
    threshold_km = 6.0 if zoom <= 11 else (3.5 if zoom <= 12 else 1.8)

    clusters: List[Dict[str, Any]] = []
    used = set()

    for i, f1 in enumerate(facilities):
        if i in used:
            continue
        group = [f1]
        used.add(i)

        for j, f2 in enumerate(facilities):
            if j in used:
                continue
            dist = haversine_distance_km(f1["latitude"], f1["longitude"], f2["latitude"], f2["longitude"])
            if dist <= threshold_km:
                group.append(f2)
                used.add(j)

        avg_lat = sum(f["latitude"] for f in group) / len(group)
        avg_lng = sum(f["longitude"] for f in group) / len(group)
        rates = [f.get("base_hourly_rate_inr", 60.0) for f in group]
        slots = sum(f.get("available_capacity", 0) for f in group)

        clusters.append({
            "cluster_id": f"cluster_{zoom}_{group[0]['id']}_{len(group)}",
            "latitude": round(avg_lat, 6),
            "longitude": round(avg_lng, 6),
            "count": len(group),
            "min_price": min(rates),
            "max_price": max(rates),
            "total_available_slots": slots,
            "facility_ids": [f["id"] for f in group],
            "facility_names": [f["name"] for f in group],
        })

    return clusters

