const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: password,
  port: 5432,
});

// Geocode function
const geocodeAddress = async (address) => {
  try {
    console.log('Geocoding address:', address);
    const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY';
    const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
      params: { address, key: apiKey },
    });

    if (response.data.status === 'OK') {
      const location = response.data.results[0].geometry.location;
      return { latitude: location.lat, longitude: location.lng };
    } else {
      console.error(`Geocoding failed for ${address}:`, response.data.status);
      return null;
    }
  } catch (error) {
    console.error(`Error geocoding ${address}:`, error.message);
    return null;
  }
};

// Periodically check for new restaurants that need geocoding
const updateMissingCoordinates = async () => {
  try {
    const result = await pool.query(
      'SELECT id, location FROM food_items WHERE latitude IS NULL OR longitude IS NULL'
    );

    for (const restaurant of result.rows) {
      const { id, location } = restaurant;
      const geocodedLocation = await geocodeAddress(location);

      if (geocodedLocation) {
        await pool.query(
          'UPDATE food_items SET latitude = $1, longitude = $2 WHERE id = $3',
          [geocodedLocation.latitude, geocodedLocation.longitude, id]
        );

        console.log(`Updated ${location}: ${geocodedLocation.latitude}, ${geocodedLocation.longitude}`);
        io.emit('new-restaurant', {
          id,
          location,
          latitude: geocodedLocation.latitude,
          longitude: geocodedLocation.longitude
        });
      }
    }
  } catch (err) {
    console.error('Error updating missing coordinates:', err.message);
  }
};

// Run coordinate update every 10 seconds
setInterval(updateMissingCoordinates, 10000);

app.get('/restaurants', async (req, res) => {
  try {
    const { cuisine, availability, distance, lat, lng } = req.query;
    console.log("Received query params:", {
      cuisine,
      availability,
      distance,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    });

    let query = 'SELECT * FROM food_items WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Handle distance filter first to reserve $1, $2, $3 for lat, lng, distance
    if (distance && distance !== 'Any' && lat && lng) {
      const parsedDistance = parseFloat(distance);
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      console.log("Distance filter applied:", { parsedLat, parsedLng, parsedDistance });
      if (isNaN(parsedDistance) || isNaN(parsedLat) || isNaN(parsedLng)) {
        console.error('Invalid distance, lat, or lng:', { distance, lat, lng });
        return res.status(400).json({ error: 'Invalid distance, latitude, or longitude parameters' });
      }
      query = 'SELECT *, (3958.8 * acos(LEAST(1.0, GREATEST(-1.0, sin(radians(latitude)) * sin(radians($1)) + cos(radians(latitude)) * cos(radians($1)) * cos(radians($2) - radians(longitude)))))) AS calc_distance FROM food_items WHERE 1=1';
      query += ` AND (3958.8 * acos(LEAST(1.0, GREATEST(-1.0, sin(radians(latitude)) * sin(radians($1)) + cos(radians(latitude)) * cos(radians($1)) * cos(radians($2) - radians(longitude)))))) <= $3`;
      params.push(parsedLat, parsedLng, parsedDistance);
      paramIndex += 3;
    }

    // Handle cuisine filter
    if (cuisine) {
      const cuisineArray = cuisine.split(',').filter(c => c.trim());
      if (cuisineArray.length > 0) {
        query += ` AND (cuisine ILIKE ANY (ARRAY[${cuisineArray.map((_, i) => `$${paramIndex + i}`).join(',')}]::text[]) OR cuisine ILIKE 'All')`;
        cuisineArray.forEach(c => params.push(`%${c.trim()}%`));
        paramIndex += cuisineArray.length;
      }
    }

    // Handle availability filter
    if (availability) {
      query += ` AND number_of_bags >= $${paramIndex}`;
      params.push(parseInt(availability));
      paramIndex += 1;
    }

    query += ' AND latitude IS NOT NULL AND longitude IS NOT NULL';
    console.log('Executing query:', query, params);
    const result = await pool.query(query, params);
    console.log('Query result:', result.rows.map(row => ({
      restaurant_name: row.restaurant_name,
      latitude: row.latitude,
      longitude: row.longitude,
      cuisine: row.cuisine,
      number_of_bags: row.number_of_bags,
      calc_distance: row.calc_distance
    })));
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /restaurants:', err.message, err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// WebSocket Connection
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Webhook endpoint to handle Google Sheets updates
app.post('/webhook', async (req, res) => {
  try {
    const { sheetName, record } = req.body;
    console.log(`Received webhook for sheet: ${sheetName}`, record);

    if (sheetName === 'Food Leftover (Responses)') {
      const geocodedLocation = await geocodeAddress(record['Adress (street address, city, state, postal code)']);
      if (!geocodedLocation) {
        throw new Error(`Geocoding failed for address: ${record['Adress (street address, city, state, postal code)']}`);
      }
      const { latitude, longitude } = geocodedLocation;
      await pool.query(
        `
        INSERT INTO food_items (restaurant_name, location, food_type, original_price, reduced_price, number_of_bags, comments, cuisine, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (restaurant_name, food_type)
        DO UPDATE SET
          number_of_bags = EXCLUDED.number_of_bags,
          original_price = EXCLUDED.original_price,
          reduced_price = EXCLUDED.reduced_price,
          comments = EXCLUDED.comments
        `,
        [
          record['Restaurant/food store name'] || '',
          record['Adress (street address, city, state, postal code)'] || '',
          record['What foods do you give out?'] || '',
          parseFloat(record['Original cost']) || 0,
          parseFloat(record['Reduced cost']) || 0,
          parseInt(record['Number of suprise bags']) || 0,
          record['Comments'] || '',
          record['Cuisine'] || '',
          latitude,
          longitude
        ]
      );
    } else {
      console.warn(`Unknown sheet name: ${sheetName}`);
      return res.status(400).send('Unknown sheet name');
    }

    const result = await pool.query('SELECT * FROM food_items');
    io.emit('new-restaurant', result.rows);
    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Error processing webhook:', error.message);
    res.status(500).send('Error processing webhook');
  }
});

app.post('/reservations', async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, rest_name } = req.body;
    await pool.query(
      `
      INSERT INTO customer_reservations (first_name, last_name, email, phone_number, rest_name, processed)
      VALUES ($1, $2, $3, $4, $5, FALSE)
      ON CONFLICT (email, phone_number, rest_name)
      DO NOTHING
      `,
      [first_name, last_name, email, phone_number, rest_name]
    );
    await pool.query(
      `
      UPDATE food_items
      SET number_of_bags = number_of_bags - 1
      WHERE number_of_bags > 0 AND restaurant_name = $1
      `,
      [rest_name]
    );
    await pool.query(
      `
      DELETE FROM food_items
      WHERE number_of_bags <= 0 AND restaurant_name = $1
      `,
      [rest_name]
    );
    await pool.query(
      `
      UPDATE customer_reservations
      SET processed = TRUE
      WHERE email = $1 AND phone_number = $2 AND rest_name = $3
      `,
      [email, phone_number, rest_name]
    );
    const result = await pool.query('SELECT * FROM food_items');
    io.emit('new-restaurant', result.rows);
    res.status(201).json({ message: 'Reservation created' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
