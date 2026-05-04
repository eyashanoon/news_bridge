// LeftSidebar.jsx
import { useState, useEffect } from 'react';

export default function LeftSidebar({ setActivePage, activePage, onLocationChange }) {
  const [location, setLocation] = useState(null);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const commonCities = [
    { id: 'gaza', name: 'Gaza City', lat: 31.5017, lon: 34.4668 },
    { id: 'khanyounis', name: 'Khan Younis', lat: 31.3453, lon: 34.3091 },
    { id: 'rafah', name: 'Rafah', lat: 31.2919, lon: 34.2435 },
    { id: 'north_gaza', name: 'North Gaza', lat: 31.5667, lon: 34.5333 },
    { id: 'whole_gaza', name: 'All Gaza Strip', lat: 31.4167, lon: 34.4000 },
  ];

  // Global location search
  const searchLocations = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      
      const results = data.map(item => ({
        id: item.place_id,
        name: item.display_name.split(',')[0],
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon)
      }));
      
      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
    }
    setSearching(false);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchLocations(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const buttonClass = (page) =>
    `bg-white rounded-xl shadow p-4 cursor-pointer transition hover:shadow-md ${
      activePage === page ? "border-l-4 border-blue-500 font-semibold" : ""
    }`;

    const detectUserLocation = () => {
    setDetectingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          // Reverse geocoding to get location name
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await res.json();
            const name = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state || data.address.country || 'Detected Location';
            
            const userLoc = {
              name,
              lat,
              lon,
              auto: true
            };
            setLocation(userLoc);
            localStorage.setItem('user_location', JSON.stringify(userLoc));
            onLocationChange?.();
          } catch (e) {
            const userLoc = {
              name: 'Detected Location',
              lat,
              lon,
              auto: true
            };
            setLocation(userLoc);
            localStorage.setItem('user_location', JSON.stringify(userLoc));
            onLocationChange?.();
          }
          
          setDetectingLocation(false);
        },
        () => {
          setDetectingLocation(false);
        }
      );
    }
  };

  const selectCity = (city) => {
    setLocation(city);
    localStorage.setItem('user_location', JSON.stringify(city));
    onLocationChange?.();
    setLocationMenuOpen(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem('user_location');
    if (saved) {
      setLocation(JSON.parse(saved));
    }
  }, []);

  return (
    <div className="p-4 space-y-4">
      {/* Location Selector */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="text-sm text-gray-500 mb-2">News Location</div>
        
        <div className="relative">
          <button 
            onClick={() => setLocationMenuOpen(!locationMenuOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span>📍</span>
              <span className="font-medium">{location ? location.name : 'Select Location'}</span>
            </div>
            <span className="text-gray-400">▼</span>
          </button>

          {locationMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white rounded shadow-lg z-50 border max-h-[400px] overflow-hidden flex flex-col">
              <button 
                onClick={detectUserLocation}
                disabled={detectingLocation}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b flex items-center gap-2 disabled:opacity-50 flex-shrink-0"
              >
                <span>{detectingLocation ? '🔄' : '📍'}</span>
                {detectingLocation ? 'Detecting...' : 'Auto Detect Location'}
              </button>
              
              {/* Search Input */}
              <div className="p-2 border-b flex-shrink-0">
                <input
                  type="text"
                  placeholder="🔍 Search any city, town, country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                  autoFocus
                />
              </div>
              
              <div className="overflow-y-auto flex-1 p-1">
                {searching && (
                  <div className="px-4 py-2 text-gray-500 text-sm">Searching...</div>
                )}
                
                {!searchQuery && !searching && commonCities.map(city => (
                  <button
                    key={city.id}
                    onClick={() => selectCity(city)}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 rounded ${location?.id === city.id ? 'bg-blue-50 text-blue-600' : ''}`}
                  >
                    {city.name}
                  </button>
                ))}
                
                {searchResults.map(result => (
                  <button
                    key={result.id}
                    onClick={() => selectCity(result)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 rounded text-sm"
                  >
                    <div className="font-medium">{result.name}</div>
                    <div className="text-gray-500 text-xs">{result.fullName}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {location && (
          <div className="mt-2 text-sm text-gray-600 flex items-center gap-1">
            <span>✓ Showing news for</span>
            <span className="font-medium">{location.name}</span>
          </div>
        )}
      </div>

      <div
        className={buttonClass("HOME")}
        onClick={() => setActivePage("HOME")}
      >
        📰 Categories / Feed
      </div>

      <div
        className={buttonClass("TRENDING")}
        onClick={() => setActivePage("TRENDING")}
      >
        🔥 Trending Topics
      </div>

      <div
        className={buttonClass("SAVED")}
        onClick={() => setActivePage("SAVED")}
      >
        💾 Saved News
      </div>
    </div>
  );
}