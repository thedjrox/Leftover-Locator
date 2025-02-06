const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios'); // Import Axios


const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: '',
  host: '',
  database: '',
  password: '',
  port: ,
});

// Get all restaurants
app.get('/restaurants', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM food_items');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


const geocodeAddress = async (address) => {
  console.log('Geocoding address:', address); // Add log to check address being geocoded

  const apiKey = 'API KEY';
  const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
    params: {
      address: address,
      key: apiKey,
    },
  });

  console.log('Geocoding response:', response.data); // Log response data


  if (response.data.status === 'OK') {
    const location = response.data.results[0].geometry.location;
    return location;
  } else {
    throw new Error('Geocoding failed');
  }
};

// Update restaurant coordinates
app.post('/update-coordinates', async (req, res) => {
  console.log('Received request to update coordinates'); // Confirm route hit

  try {
    const restaurants = await pool.query('SELECT id, location FROM food_items');

    for (const restaurant of restaurants.rows) {
      try {
        const geocodedLocation = await geocodeAddress(restaurant.location);
        await pool.query(
          'UPDATE food_items SET latitude = $1, longitude = $2 WHERE id = $3',
          [geocodedLocation.latitude, geocodedLocation.longitude, restaurant.id]
        );
        console.log(`Updated ${restaurant.location}: ${geocodedLocation.latitude}, ${geocodedLocation.longitude}`);
        console.log('Update result:', result.rows); // Log result of the update

      } catch (err) {
        console.error(`Error updating ${restaurant.location}:`, err.message);
      }
    }

    res.send('Coordinates updated successfully');
  } catch (err) {
    console.error('Error fetching restaurants from database:', err.message);
    res.status(500).send('Server error');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
