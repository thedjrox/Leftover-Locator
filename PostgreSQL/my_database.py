import json
import psycopg2
import gspread
from oauth2client.service_account import ServiceAccountCredentials

def fetch_google_sheet_data(sheet_name):
    # Google Sheets authentication
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds = ServiceAccountCredentials.from_json_keyfile_name('C:\\Users\\thedj\\my_lambda_function\\glassy-wave-424922-c4-b9290ab4d5db.json', scope)
    client = gspread.authorize(creds)

    # Connect to the specified Google Sheet
    sheet = client.open(sheet_name).sheet1
    records = sheet.get_all_records()

    return records


def reset_tables(conn, cur):

 # Drop table if exists
    cur.execute('''
        DROP TABLE IF EXISTS food_items CASCADE;
        DROP TABLE IF EXISTS customer_reservations CASCADE;
    ''')
    conn.commit()

def create_tables():

    # Create table if not exists
    cur.execute('''
        CREATE TABLE IF NOT EXISTS food_items (
            id SERIAL PRIMARY KEY,
            restaurant_name TEXT UNIQUE,
            location TEXT,
            food_type TEXT,
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


def insert_data(food_records, reservation_records):

    """print(food_records[:5])  # Print first 5 records to check key names
    print("*****************************************************************************************************")
    print(reservation_records[:5])  # Print first 5 records to check key names"""



    # Insert/Update records in PostgreSQL
    for record in food_records:
        cur.execute('''
            INSERT INTO food_items (restaurant_name, location, food_type, original_price, reduced_price, number_of_bags, comments)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (restaurant_name, food_type) 
            DO UPDATE SET number_of_bags = EXCLUDED.number_of_bags
        ''', (record['Restaurant/food store name'], record['Adress (street address, city, state, postal code)'], record['What foods do you give out?'], record['Original cost'], record['Reduced cost'], record['Number of suprise bags'], record['Comments']))

    conn.commit()

    # Insert customer reservations into customer_reservations table and update food_items
    for reservation in reservation_records:
        # Insert the reservation
        cur.execute('''
            INSERT INTO customer_reservations (first_name, last_name, email, phone_number, rest_name, processed)
            VALUES (%s, %s, %s, %s, %s, FALSE)
            ON CONFLICT (email, phone_number, rest_name) 
            DO NOTHING  -- Skip duplicates
        ''', (reservation['First Name'], reservation['Last Name'], reservation['Email'], reservation['Phone Number'], reservation['Restaurant Name']))
        
    
    conn.commit()


def is_new_food_data(food_records):
    # Check if there's any data in the table
    cur.execute("SELECT COUNT(*) FROM food_items")
    count = cur.fetchone()[0]

    if count == 0:
        return True  # If table is empty, insert everything

    # Get all restaurant names from the database
    cur.execute("SELECT restaurant_name FROM food_items")
    existing_restaurants = {row[0] for row in cur.fetchall()}

    # Compare with Google Sheets records
    new_data = any(record['Restaurant/food store name'] not in existing_restaurants for record in food_records)
    return new_data



def is_new_reservation_data(reservation_records):
    cur.execute("SELECT COUNT(*) FROM customer_reservations")
    count = cur.fetchone()[0]

    if count == 0:
        return True  # If table is empty, insert everything

    # Get all existing reservations from the database
    cur.execute("SELECT email, phone_number, rest_name FROM customer_reservations")
    existing_reservations = {tuple(row) for row in cur.fetchall()}

    # Compare with Google Sheets records
    new_data = any(
        (record['Email'], record['Phone Number'], record['Restaurant Name']) not in existing_reservations
        for record in reservation_records
    )
    return new_data


def update_data():
    # Select unprocessed reservations
    cur.execute('''
        SELECT rest_name FROM customer_reservations
        WHERE processed = FALSE
    ''')
    
    new_reservations = cur.fetchall()  # Get all unprocessed reservations

    for reservation in new_reservations:
        restaurant_name = reservation[0]

        # Deduct 1 from number_of_bags where there are bags left
        cur.execute('''
            UPDATE food_items
            SET number_of_bags = number_of_bags - 1
            WHERE number_of_bags > 0 AND restaurant_name = %s
        ''', (restaurant_name,))

        # Remove food item if number_of_bags reaches 0
        cur.execute('''
            DELETE FROM food_items
            WHERE number_of_bags <= 0 AND restaurant_name = %s
        ''', (restaurant_name,))

    # Mark processed reservations as TRUE
    cur.execute('''
        UPDATE customer_reservations
        SET processed = TRUE
        WHERE processed = FALSE
    ''')
    
    conn.commit()
    

# Manually insert and update database
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
    reset_tables(conn, cur)
    
    create_tables()

    food_records = fetch_google_sheet_data("Food Leftover (Responses)")
    reservation_records = fetch_google_sheet_data("Customer Reservation (Responses)")

    new_reservations_exist = is_new_reservation_data(reservation_records)

    # Insert only if new data is detected
    if is_new_food_data(food_records) or new_reservations_exist:
        print("New data detected. Updating database...")
        insert_data(food_records, reservation_records)


    # Update only if new reservations exist
    if new_reservations_exist:
        print("Processing new reservations...")
        update_data()
    
    cur.close()
    conn.close()
    print('Database check completed!')
