import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap, LoadScript } from '@react-google-maps/api';

const containerStyle = {
  width: '100vw',
  height: '100vh'
};

const center = {
  lat: 38.89511,
  lng: -77.03637
};

const testRestaurants = [
  { id: 1, lat: 38.8462200, lng: -77.30637000, restaurant_name: "Test Restaurant" }
];

function App() {
  const [restaurants, setRestaurants] = useState([]);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (mapRef.current) {
      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      testRestaurants.forEach((restaurant) => {
        const marker = new window.google.maps.Marker({
          position: { lat: restaurant.lat, lng: restaurant.lng },
          map: mapRef.current,
          title: restaurant.restaurant_name
        });

        markersRef.current.push(marker);

        console.log('Marker created:', marker); // Confirm marker creation
      });
    }
  }, [restaurants]);

  return (
    <LoadScript
      googleMapsApiKey="API KEY"
      loadingElement={<div>Loading...</div>} // Optional: Display while loading
      onLoad={() => console.log('Script loaded')} // Confirm script load
    >
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={(map) => (mapRef.current = map)}
      >
        {/* Map children components, like markers, can go here */}
      </GoogleMap>
    </LoadScript>
  );
}

export default App;
