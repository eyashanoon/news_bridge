"""
Geographic Location Extractor for News Articles
Extracts and scores location relevance from news content
"""
import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

@dataclass
class GeoLocation:
    name: str
    lat: float
    lon: float
    level: int  # 0=city, 1=region, 2=country, 3=international
    confidence: float = 1.0

# Known locations database
KNOWN_LOCATIONS = [
    GeoLocation("Gaza City", 31.5017, 34.4668, 0),
    GeoLocation("Khan Younis", 31.3453, 34.3091, 0),
    GeoLocation("Rafah", 31.2919, 34.2435, 0),
    GeoLocation("North Gaza", 31.5667, 34.5333, 0),
    GeoLocation("Gaza Strip", 31.4167, 34.4000, 1),
    GeoLocation("Palestine", 31.9522, 35.2332, 2),
    GeoLocation("Israel", 31.0461, 34.8516, 2),
    GeoLocation("Egypt", 26.8206, 30.8025, 2),
    GeoLocation("Jordan", 30.5852, 36.2384, 2),
    GeoLocation("Lebanon", 33.8547, 35.8623, 2),
    GeoLocation("Syria", 34.8021, 38.9968, 2),
]

# Location synonyms mapping
LOCATION_SYNONYMS = {
    "gaza": "Gaza City",
    "gazacity": "Gaza City",
    "khanyounis": "Khan Younis",
    "khan younis": "Khan Younis",
    "rafah": "Rafah",
    "northgaza": "North Gaza",
    "gaza strip": "Gaza Strip",
    "palestine": "Palestine",
    "israel": "Israel",
    "egypt": "Egypt",
    "jordan": "Jordan",
    "lebanon": "Lebanon",
    "syria": "Syria",
}

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers"""
    import math
    R = 6371  # Earth radius in km
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat/2) * math.sin(dlat/2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dlon/2) * math.sin(dlon/2)
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def extract_locations_from_text(text: str, title: Optional[str] = None) -> List[GeoLocation]:
    """Extract all mentioned locations from article text"""
    found_locations = []
    text_lower = text.lower()
    
    # Check title first (higher weight)
    if title:
        title_lower = title.lower()
        for loc_name, canonical in LOCATION_SYNONYMS.items():
            if loc_name in title_lower:
                loc = next((l for l in KNOWN_LOCATIONS if l.name == canonical), None)
                if loc:
                    found_locations.append(GeoLocation(
                        loc.name, loc.lat, loc.lon, loc.level,
                        confidence=0.95  # Title mentions have high confidence
                    ))
    
    # Check body text
    for loc_name, canonical in LOCATION_SYNONYMS.items():
        if loc_name in text_lower:
            loc = next((l for l in KNOWN_LOCATIONS if l.name == canonical), None)
            if loc and not any(f.name == loc.name for f in found_locations):
                # Count occurrences
                count = len(re.findall(r'\b' + re.escape(loc_name) + r'\b', text_lower))
                confidence = min(0.3 + (count * 0.15), 0.85)
                found_locations.append(GeoLocation(
                    loc.name, loc.lat, loc.lon, loc.level,
                    confidence=confidence
                ))
    
    return found_locations

def calculate_geo_multiplier(user_lat: float, user_lon: float, 
                            article_locations: List[GeoLocation], 
                            category: str = "General") -> float:
    """
    Calculate geographic priority multiplier
    Returns weight from 0.1 to 10.0
    """
    # Sports category exception: global gets priority
    if category.lower() == "sports":
        if not article_locations:
            return 2.2  # Global sports gets boost
        # For sports, inverse weighting: farther = better
        max_distance = max(haversine_distance(user_lat, user_lon, loc.lat, loc.lon) 
                          for loc in article_locations) if article_locations else 0
        
        if max_distance < 50:
            return 0.4  # Local sports de-prioritized
        elif max_distance < 500:
            return 0.8
        elif max_distance < 2000:
            return 1.5
        else:
            return 2.2  # International sports highest
    
    # Normal categories: closer = better
    if not article_locations:
        return 1.0  # No location data = neutral
    
    # Find closest location in article
    min_distance = float('inf')
    best_confidence = 0.0
    
    for loc in article_locations:
        distance = haversine_distance(user_lat, user_lon, loc.lat, loc.lon)
        if distance < min_distance:
            min_distance = distance
            best_confidence = loc.confidence
    
    # Apply distance based multiplier
    if min_distance < 15:
        base = 10.0
    elif min_distance < 50:
        base = 7.0
    elif min_distance < 150:
        base = 5.0
    elif min_distance < 500:
        base = 3.0
    elif min_distance < 1500:
        base = 1.5
    else:
        base = 1.0
    
    # Adjust by confidence
    return base * best_confidence

def get_geographic_priority_level(distance_km: float) -> int:
    """Return priority level 0-5 based on distance"""
    if distance_km < 15:
        return 0
    elif distance_km < 50:
        return 1
    elif distance_km < 150:
        return 2
    elif distance_km < 500:
        return 3
    elif distance_km < 1500:
        return 4
    else:
        return 5