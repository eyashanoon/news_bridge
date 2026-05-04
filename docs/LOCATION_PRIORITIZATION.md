# Geographic News Prioritization Implementation

## Complete Implementation Status ✅

### ✅ Frontend Features Implemented:
1. **Location Selector in Top Bar**
   - Dropdown menu with pre-defined cities (Gaza City, Khan Younis, Rafah, North Gaza)
   - Automatic browser geolocation detection
   - Location saved to localStorage and user profile
   - Instant feed refresh when location changes

2. **Feed Integration**
   - User location coordinates automatically passed to `/api/feed` endpoint as `lat` and `lon` parameters
   - Feed fully reloads when user changes location
   - Works across all news categories

### ✅ Backend Library Implemented:
`/backend/ai-service/ingestion/geo_extractor.py`

Features:
- Geographic NER extraction from article titles and body text
- Haversine distance calculation
- Location priority scoring algorithm
- **Special Sports category handling**: Global sports get higher priority, local sports are deprioritized
- Confidence scoring for location mentions

---

## Priority Levels (Highest to Lowest)

| Distance | Weight Multiplier | Description |
|----------|-------------------|-------------|
| < 15 km  | 10.0x             | Exact user city |
| < 50 km  | 7.0x              | Nearby cities |
| < 150 km | 5.0x              | Same region |
| < 500 km | 3.0x              | Whole country |
| < 1500 km| 1.5x              | Neighbouring countries |
| > 1500 km| 1.0x              | Rest of world |

### ⚽ Sports Category Exception
For Sports news the weighting is INVERTED:
- Local sports: **0.4x** (lower priority)
- National sports: **0.8x**
- Regional sports: **1.5x**
- International sports: **2.2x** (highest priority)

---

## Backend Integration Steps

1. **During article ingestion**:
```python
from ingestion.geo_extractor import extract_locations_from_text

locations = extract_locations_from_text(article_content, article_title)
# Store locations array with article metadata
```

2. **During feed ranking**:
```python
from ingestion.geo_extractor import calculate_geo_multiplier

user_lat = request.args.get('lat', type=float)
user_lon = request.args.get('lon', type=float)

if user_lat and user_lon:
    geo_multiplier = calculate_geo_multiplier(
        user_lat, user_lon, 
        article.locations, 
        article.category
    )
    final_score = base_score * geo_multiplier
```

3. **Sort posts by final_score descending**

---

## API Changes Required

Add these parameters to your existing `/api/feed` endpoint:
- `lat` (float): User latitude
- `lon` (float): User longitude

These are already being sent automatically from the frontend.

---

## Usage Instructions

1. User clicks location button in top navigation bar
2. Either select a city manually or use "Auto Detect Location"
3. News feed will automatically refresh and prioritize news according to selected location
4. Sports news will automatically show international matches first