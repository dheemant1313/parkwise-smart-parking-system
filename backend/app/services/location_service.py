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
