// TopBar.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import { getUserId } from '../utils/userId';

const gradientMap = {
  General: "from-gray-600 to-gray-400",
  Politics: "from-blue-600 to-blue-400",
  Sports: "from-orange-500 to-orange-300",
  Finance: "from-green-600 to-green-400",
  Medical: "from-red-600 to-red-400",
  Tech: "from-cyan-600 to-cyan-400",
  Culture: "from-purple-600 to-purple-400",
  Religion: "from-amber-500 to-yellow-300",
};

export default function TopBar({ category, onLocationChange }) {
  const [location, setLocation] = useState(null);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const cities = [
    { id: 'gaza', name: 'Gaza City', lat: 31.5017, lon: 34.4668 },
    { id: 'khanyounis', name: 'Khan Younis', lat: 31.3453, lon: 34.3091 },
    { id: 'rafah', name: 'Rafah', lat: 31.2919, lon: 34.2435 },
    { id: 'north_gaza', name: 'North Gaza', lat: 31.5667, lon: 34.5333 },
    { id: 'whole_gaza', name: 'All Gaza Strip', lat: 31.4167, lon: 34.4000 },
  ];

  const detectUserLocation = () => {
    setDetectingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const userLoc = {
            name: 'Detected Location',
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            auto: true
          };
          setLocation(userLoc);
          await saveUserLocation(userLoc);
          onLocationChange?.(userLoc);
          setDetectingLocation(false);
        },
        () => {
          setDetectingLocation(false);
        }
      );
    }
  };

  const selectCity = async (city) => {
    setLocation(city);
    await saveUserLocation(city);
    onLocationChange?.(city);
    setLocationMenuOpen(false);
  };

  const saveUserLocation = async (loc) => {
    try {
      await apiFetch(`/api/user/${getUserId()}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc)
      });
    } catch (e) {
      console.error('Failed to save location', e);
    }
  };

  useEffect(() => {
    // Load saved location on mount
    const saved = localStorage.getItem('user_location');
    if (saved) {
      setLocation(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (location) {
      localStorage.setItem('user_location', JSON.stringify(location));
    }
  }, [location]);

  return (
    <div className={`w-full h-14 text-white flex items-center justify-between px-6 shadow bg-gradient-to-r ${gradientMap[category] || gradientMap.General}`}>
      <div className="font-bold text-lg">AI News</div>

      <div className="flex items-center gap-4">
        {/* Location Selector */}
        <div className="relative">
          <button 
            onClick={() => setLocationMenuOpen(!locationMenuOpen)}
            className="bg-black/20 hover:bg-black/30 px-3 py-1 rounded flex items-center gap-2 transition-colors"
          >
            <span>📍</span>
            <span>{location ? location.name : 'Select Location'}</span>
          </button>

          {locationMenuOpen && (
            <div className="absolute top-full mt-1 right-0 bg-white text-gray-800 rounded shadow-lg min-w-[200px] z-50">
              <button 
                onClick={detectUserLocation}
                disabled={detectingLocation}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-200 flex items-center gap-2 disabled:opacity-50"
              >
                <span>{detectingLocation ? '🔄' : '📍'}</span>
                {detectingLocation ? 'Detecting...' : 'Auto Detect Location'}
              </button>
              
              <div className="p-1">
                {cities.map(city => (
                  <button
                    key={city.id}
                    onClick={() => selectCity(city)}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 rounded ${location?.id === city.id ? 'bg-blue-50 text-blue-600' : ''}`}
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button className="bg-white text-black px-3 py-1 rounded">Login</button>
          <button className="bg-white text-black px-3 py-1 rounded">Sign Up</button>
          <button className="bg-black/20 px-3 py-1 rounded">Logout</button>
        </div>
      </div>
    </div>
  );
}
