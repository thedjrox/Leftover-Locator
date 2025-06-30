import React, { useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import io from "socket.io-client";

const cuisineIcons = {
  Asian: "🍱",
  American: "🍔",
  European: "🥖",
  African: "🍛",
  "South American": "🥩",
};

const containerStyle = {
  width: "100vw",
  height: "100vh",
};

const defaultCenter = { lat: 38.877548, lng: -77.378181 }; // Your house coordinates

const LIBRARIES = ["marker"];
const MAP_ID = "1577d9d10269ddf4";

function App() {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyCK63fL4RQfSgtKDfXT8U-6_jdBv4-fhXs",
    libraries: LIBRARIES,
  });

  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [cuisine, setCuisine] = useState([]); // Changed to array
  const [availability, setAvailability] = useState("");
  const [distance, setDistance] = useState("");
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    console.log("Starting geolocation useEffect, defaultCenter:", defaultCenter);
    const socket = io("http://localhost:3000");
    socket.on("connect", () => console.log("Socket.IO connected"));
    socket.on("new-restaurant", (updatedData) => {
      console.log("Received new-restaurant data:", updatedData);
      setRestaurants(updatedData);
      setFilteredRestaurants(updatedData);
    });
    socket.on("disconnect", () => console.log("Socket.IO disconnected"));
    socket.on("error", (error) => console.error("Socket.IO error:", error));
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        console.log("Fetching restaurants with no filters");
        const response = await fetch("http://localhost:3000/restaurants");
        const data = await response.json();
        console.log("Initial restaurants fetched:", data);
        setRestaurants(data);
        setFilteredRestaurants(data);
      } catch (error) {
        console.error("Error fetching restaurants:", error);
      }
    };

    if (navigator.geolocation) {
      console.log("Browser supports geolocation, requesting position...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log("Geolocation success:", { latitude, longitude, accuracy });
          const distanceToHouse = Math.sqrt(
            Math.pow(latitude - defaultCenter.lat, 2) + Math.pow(longitude - defaultCenter.lng, 2)
          ) * 69; // Rough conversion to miles
          console.log("Distance to house (miles):", distanceToHouse);
          if (distanceToHouse > 10) {
            console.warn("Geolocation too far from house:", { latitude, longitude, distanceToHouse });
            setUserLocation(defaultCenter);
            console.log("Set userLocation to defaultCenter:", defaultCenter);
            if (distance && distance !== "Any") {
              alert("Geolocation is too far from Chantilly, VA. Using your home coordinates.");
            }
          } else {
            setUserLocation({ lat: latitude, lng: longitude });
            console.log("Set userLocation to geolocation:", { lat: latitude, lng: longitude });
            if (accuracy > 5000 && distance && distance !== "Any") {
              console.warn("Low geolocation accuracy:", { latitude, longitude, accuracy });
              alert("Geolocation accuracy is low. Results may be less precise.");
            }
          }
          fetchRestaurants();
        },
        (error) => {
          console.error("Geolocation error:", error.message, error.code);
          setUserLocation(defaultCenter);
          console.log("Set userLocation to defaultCenter due to error:", defaultCenter);
          fetchRestaurants();
          if (distance && distance !== "Any") {
            alert("Unable to get your location. Using your home coordinates (Chantilly, VA).");
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      console.error("Geolocation not supported by browser");
      setUserLocation(defaultCenter);
      console.log("Set userLocation to defaultCenter (no geolocation):", defaultCenter);
      fetchRestaurants();
      if (distance && distance !== "Any") {
        alert("Geolocation not supported. Using your home coordinates (Chantilly, VA).");
      }
    }
  }, [distance]);

  useEffect(() => {
    const fetchFilteredRestaurants = async () => {
      try {
        console.log("fetchFilteredRestaurants called, userLocation:", userLocation);
        if (distance && distance !== "Any" && (!userLocation || !userLocation.lat || !userLocation.lng)) {
          console.warn("Invalid userLocation, setting to defaultCenter:", defaultCenter);
          setUserLocation(defaultCenter);
          alert("Location not available. Using your home coordinates (Chantilly, VA).");
        }
        const params = new URLSearchParams();
        if (cuisine.length > 0) params.append("cuisine", cuisine.join(",")); // Join array to string
        if (availability) params.append("availability", availability);
        if (distance && distance !== "Any") {
          params.append("distance", distance);
          params.append("lat", userLocation.lat);
          params.append("lng", userLocation.lng);
        }
        console.log("Sending query params to backend:", params.toString());
        const response = await fetch(`http://localhost:3000/restaurants?${params}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
        }
        const data = await response.json();
        console.log("Received restaurants:", data);
        if (data.length === 0) {
          alert(
            `No restaurants found within ${distance || "selected"} miles${
              cuisine.length > 0 ? " for " + cuisine.join(", ") : ""
            }. Try increasing the distance or selecting "Any".`
          );
        }
        setFilteredRestaurants(data);
        addMarkers(data);
      } catch (error) {
        console.error("Error fetching filtered restaurants:", error.message, error.stack);
        alert(`Error fetching restaurants: ${error.message}`);
      }
    };
    fetchFilteredRestaurants();
  }, [cuisine, availability, distance, userLocation]);

  const addMarkers = async (restaurantList) => {
    if (!mapRef.current || !window.google) return;

    const { AdvancedMarkerElement, PinElement } = await window.google.maps.importLibrary("marker");
    const { InfoWindow } = await window.google.maps.importLibrary("maps");

    const infoWindow = new InfoWindow();

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    restaurantList.forEach((restaurant) => {
      const position = { lat: restaurant.latitude, lng: restaurant.longitude };
      const pin = new PinElement({ glyph: "🍴", scale: 1.5 });
      const marker = new AdvancedMarkerElement({
        position,
        map: mapRef.current,
        title: restaurant.restaurant_name,
        content: pin.element,
        gmpClickable: true,
      });

      marker.addListener("click", () => {
        infoWindow.setContent(`
          <style>
            .info-window-content input {
              margin: 5px 0;
              padding: 5px;
              width: 100%;
              box-sizing: border-box;
              background: #fff;
              color: #000;
            }
            .info-window-content button {
              background: #28a745;
              color: white;
              border: none;
              padding: 8px;
              cursor: pointer;
              width: 100%;
              border-radius: 4px;
            }
            .info-window-content button:hover {
              background: #218838;
            }
          </style>
          <div class="info-window-content">
            <strong>${restaurant.restaurant_name}</strong><br>
            Cuisine: ${cuisineIcons[restaurant.cuisine] || "🍽️"} ${restaurant.cuisine}<br>
            Available: ${restaurant.number_of_bags} surprise bags<br>
            <form id="reserve-form-${restaurant.id}">
              <input type="text" placeholder="First Name" name="first_name" required><br>
              <input type="text" placeholder="Last Name" name="last_name" required><br>
              <input type="email" placeholder="Email" name="email" required><br>
              <input type="tel" placeholder="Phone Number" name="phone_number" required><br>
              <button type="submit">Reserve Now</button>
            </form>
          </div>
        `);
        infoWindow.open(mapRef.current, marker);

        document.getElementById(`reserve-form-${restaurant.id}`).addEventListener("submit", async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          try {
            const response = await fetch("http://localhost:3000/reservations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                first_name: formData.get("first_name"),
                last_name: formData.get("last_name"),
                email: formData.get("email"),
                phone_number: formData.get("phone_number"),
                rest_name: restaurant.restaurant_name
              })
            });
            if (response.ok) {
              alert("Reservation successful!");
              infoWindow.close();
            } else {
              alert("Reservation failed.");
            }
          } catch (error) {
            console.error("Error reserving:", error);
            alert("Error reserving.");
          }
        });
      });

      markersRef.current.push(marker);
    });
  };

  if (loadError) return <p>Error loading Google Maps</p>;
  if (!isLoaded) return <p>Loading Map...</p>;

  return (
    <div>
      <div style={{
        padding: "15px",
        background: "#fff",
        color: "#000",
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 1000,
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        maxWidth: "300px"
      }}>
        <h3 style={{ margin: "0 0 10px", fontSize: "18px" }}>Filter Restaurants</h3>
        <label style={{ fontWeight: "bold" }}>Cuisine:</label>
        <div style={{ marginBottom: "10px" }}>
          {["Asian", "American", "European", "African", "South American"].map((type) => (
            
            <label key={type} style={{ display: "flex", alignItems: "center", margin: "5px 0", gap: "6px" }}>
              <input
                type="checkbox"
                value={type}
                checked={cuisine.includes(type)}
                onChange={(e) => {
                  const selected = e.target.value;
                  setCuisine((prev) =>
                    prev.includes(selected)
                      ? prev.filter((c) => c !== selected)
                      : [...prev, selected]
                  );
                }}
              />
              <span>{cuisineIcons[type]} {type}</span>
            </label>
          ))}
        </div>

        <label style={{ fontWeight: "bold" }}>Number of Suprise Bags:</label>
        <select
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          style={{ display: "block", margin: "5px 0 10px", width: "100%" }}
        >
          <option value="">Any</option>
          <option value="1">1+</option>
          <option value="3">3+</option>
          <option value="5">5+</option>
        </select>
        <label style={{ fontWeight: "bold" }}>Max Distance (miles):</label>
        <select
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          style={{ display: "block", margin: "5px 0", width: "100%" }}
        >
          <option value="">Any</option>
          <option value="1">1 mile</option>
          <option value="5">5 miles</option>
          <option value="10">10 miles</option>
        </select>
      </div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={userLocation || defaultCenter}
        zoom={12}
        options={{ mapId: MAP_ID }}
        onLoad={(map) => {
          mapRef.current = map;
          addMarkers(filteredRestaurants);
        }}
      />
    </div>
  );
}

export default App;