# Leftover Locator

## Overview

Leftover Location is a web application designed to reduce food waste by connecting users with restaurants and food stores offering surplus food at discounted prices. Users can filter available "surprise bags" by cuisine, distance, and availability, view restaurants on an interactive Google Maps interface, and reserve food items directly. The app integrates real-time updates via WebSockets and a PostgreSQL database, showcasing my skills in full-stack development, API integration, and real-time web applications.
Features

- Interactive Map: Displays nearby restaurants with available surprise bags using Google Maps API.
- Real-Time Updates: Restaurants and availability are updated in real-time via WebSocket connections.
- Filters: Users can filter by cuisine (e.g., Asian, American), number of surprise bags, and distance (up to 10 miles).
- Reservations: Users can reserve surprise bags with a simple form, updating the database instantly.
- Geolocation: Uses browser geolocation to center the map, falling back to default coordinates if needed.

## Technologies Used

- Frontend: React, @react-google-maps/api, Socket.IO-client, CSS
- Backend: Node.js, Express, Socket.IO, PostgreSQL (pg), Axios
- Database Setup: Python, Psycopg2
- External APIs: Google Maps JavaScript API, Google Geocoding API
- Other: WebSocket for real-time updates, Google Sheets webhook integration

## Prerequisites

- Node.js (v16 or higher)
- Python (3.8 or higher)
- PostgreSQL (v12 or higher)
- Google Maps API key (for Maps JavaScript API and Geocoding API)

## Execution command

- npm run dev (to run the frontend)
- node server.js (to run the backend)

## Access the App:

Open http://localhost:3000 in your browser (or the port configured by your React setup).

## Usage

- Browse Restaurants: View restaurants with available surprise bags on the map.
- Apply Filters: Use the filter panel to select cuisine types, minimum number of surprise bags, and maximum distance.
- Reserve a Bag: Click a restaurant marker, fill out the reservation form, and submit to reserve a surprise bag.
- Real-Time Updates: New restaurants or changes in availability are reflected instantly via WebSocket updates.

