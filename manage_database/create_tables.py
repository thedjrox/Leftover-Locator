import psycopg2

def create_tables():

    # Create table if not exists
    cur.execute('''
        CREATE TABLE IF NOT EXISTS food_items (
            id SERIAL PRIMARY KEY,
            restaurant_name TEXT UNIQUE,
            location TEXT,
            food_type TEXT,
            cuisine TEXT,
            original_price REAL,
            reduced_price REAL,
            number_of_bags INTEGER,
            comments TEXT,
            latitude REAL,
            longitude REAL,
            UNIQUE (restaurant_name, food_type)  -- Ensures each restaurant has unique food items    
        )
    ''')
    conn.commit()

    # Create customer_reservations table if not exists
    cur.execute('''
        CREATE TABLE IF NOT EXISTS customer_reservations (
            id SERIAL PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            phone_number TEXT,
            rest_name TEXT,
            processed BOOLEAN DEFAULT FALSE,  -- Tracks whether the reservation was processed
            UNIQUE (email, phone_number, rest_name)  -- Prevents duplicate reservations for the same person & restaurant

        )
    ''')
    conn.commit()

if __name__ == "__main__":
    # PostgreSQL connection
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password="aqua2chips",
        host="localhost",
        port="5432"
    )
    cur = conn.cursor()
    
    create_tables(conn, cur)
    
    cur.close()
    conn.close()
    print("Database tables created successfully!")