"""
Database management for Highlands Coffee Web App
SQLite connection and schema migrations
"""

import os
import sys
import sqlite3
import csv
from werkzeug.security import generate_password_hash, check_password_hash

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'coffeeshop.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Categories Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT ''
    );
    """)

    # 3. Products Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        image TEXT NOT NULL,
        description TEXT DEFAULT '',
        category_id INTEGER REFERENCES categories(id)
    );
    """)

    # 4. Orders Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_code TEXT UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        order_type TEXT NOT NULL, -- 'delivery' or 'takeaway'
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        customer_note TEXT DEFAULT '',
        payment_method TEXT NOT NULL, -- 'COD', 'VIETQR', 'MOMO'
        subtotal INTEGER NOT NULL,
        discount INTEGER DEFAULT 0,
        shipping_fee INTEGER DEFAULT 0,
        total_amount INTEGER NOT NULL,
        status TEXT DEFAULT 'Đang chuẩn bị',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 5. Order Items Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        product_image TEXT NOT NULL,
        size_code TEXT DEFAULT '',
        size_name TEXT DEFAULT '',
        sugar_level TEXT DEFAULT '',
        ice_level TEXT DEFAULT '',
        toppings_json TEXT DEFAULT '[]',
        notes TEXT DEFAULT '',
        unit_price INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        total_price INTEGER NOT NULL
    );
    """)

    conn.commit()

    # Seed demo user if not exists
    cursor.execute("SELECT id FROM users WHERE username = 'demo'")
    if not cursor.fetchone():
        demo_pwd = generate_password_hash("123456")
        cursor.execute("""
        INSERT INTO users (username, password_hash, full_name, phone, address)
        VALUES (?, ?, ?, ?, ?)
        """, ('demo', demo_pwd, 'Nguyễn Văn A', '0912345678', 'Số 123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh'))
        conn.commit()
        print("Demo user created: demo / 123456")

    # Seed categories and products from CSV if categories table empty
    cursor.execute("SELECT COUNT(*) as cnt FROM categories")
    if cursor.fetchone()['cnt'] == 0:
        seed_csv_data(conn)

    conn.close()
    print("Database initialized successfully at:", DB_PATH)

def seed_csv_data(conn):
    base_dir = os.path.dirname(__file__)
    cat_file = os.path.join(base_dir, 'data', 'category.csv')
    prod_file = os.path.join(base_dir, 'data', 'product.csv')

    cursor = conn.cursor()

    if os.path.exists(cat_file):
        with open(cat_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader, None)
            for row in reader:
                if row and row[0]:
                    cursor.execute("""
                    INSERT OR REPLACE INTO categories (id, name, description)
                    VALUES (?, ?, ?)
                    """, (int(row[0]), row[1], row[2] if len(row) > 2 else ''))

    if os.path.exists(prod_file):
        with open(prod_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader, None)
            for row in reader:
                if row and row[0]:
                    clean_desc = row[4] if len(row) > 4 else ''
                    cursor.execute("""
                    INSERT OR REPLACE INTO products (id, name, price, image, description, category_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        int(row[0]),
                        row[1],
                        int(row[2]) if row[2].isdigit() else 0,
                        row[3],
                        clean_desc,
                        int(row[6]) if len(row) > 6 and row[6].isdigit() else 1
                    ))

    conn.commit()
    print("Seeded categories and products into SQLite.")

if __name__ == '__main__':
    init_db()
