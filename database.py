"""
Database management for Highlands Coffee Web App
SQLite connection, schema migrations, and Admin helpers
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
        is_admin INTEGER DEFAULT 0,
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        image TEXT NOT NULL,
        description TEXT DEFAULT '',
        category_id INTEGER REFERENCES categories(id),
        is_available INTEGER DEFAULT 1
    );
    """)

    # Ensure is_available column exists if table was already created
    try:
        cursor.execute("ALTER TABLE products ADD COLUMN is_available INTEGER DEFAULT 1")
    except sqlite3.OperationalError:
        pass

    # Ensure is_admin column exists in users
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass

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
        status TEXT DEFAULT 'Chờ xác nhận',
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
        INSERT INTO users (username, password_hash, full_name, phone, address, is_admin)
        VALUES (?, ?, ?, ?, ?, ?)
        """, ('demo', demo_pwd, 'Nguyễn Văn A', '0912345678', 'Số 123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh', 0))
        conn.commit()

    # Seed admin user if not exists, ensure is_admin=1
    cursor.execute("SELECT id, is_admin FROM users WHERE username = 'admin'")
    admin_row = cursor.fetchone()
    if not admin_row:
        admin_pwd = generate_password_hash("highlands123")
        cursor.execute("""
        INSERT INTO users (username, password_hash, full_name, phone, address, is_admin)
        VALUES (?, ?, ?, ?, ?, ?)
        """, ('admin', admin_pwd, 'Quản Trị Viên Highlands', '19001755', 'Trụ sở Highlands Coffee Việt Nam', 1))
        conn.commit()
    elif not admin_row['is_admin']:
        cursor.execute("UPDATE users SET is_admin = 1 WHERE username = 'admin'")
        conn.commit()

    # Seed categories and products from CSV if categories table empty
    cursor.execute("SELECT COUNT(*) as cnt FROM categories")
    if cursor.fetchone()['cnt'] == 0:
        seed_csv_data(conn)

    conn.close()

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
                    INSERT OR REPLACE INTO products (id, name, price, image, description, category_id, is_available)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                    """, (
                        int(row[0]),
                        row[1],
                        int(row[2]) if row[2].isdigit() else 0,
                        row[3],
                        clean_desc,
                        int(row[6]) if len(row) > 6 and row[6].isdigit() else 1
                    ))

    conn.commit()

def get_admin_stats(conn):
    cursor = conn.cursor()
    
    # 1. Total revenue (sum of non-cancelled orders)
    cursor.execute("""
        SELECT COALESCE(SUM(total_amount), 0) as total_rev 
        FROM orders 
        WHERE status != 'Đã hủy'
    """)
    total_rev = cursor.fetchone()['total_rev']

    # 2. Total orders count
    cursor.execute("SELECT COUNT(*) as total_ord FROM orders")
    total_ord = cursor.fetchone()['total_ord']

    # 3. Pending orders
    cursor.execute("""
        SELECT COUNT(*) as pending_ord 
        FROM orders 
        WHERE status IN ('Chờ xác nhận', 'Đang chuẩn bị', 'Đang pha chế')
    """)
    pending_ord = cursor.fetchone()['pending_ord']

    # 4. Total products in menu
    cursor.execute("SELECT COUNT(*) as total_prod FROM products")
    total_prod = cursor.fetchone()['total_prod']

    # 5. Top selling items
    cursor.execute("""
        SELECT product_name, product_image, SUM(quantity) as total_qty, SUM(total_price) as total_sales
        FROM order_items
        JOIN orders ON order_items.order_id = orders.id
        WHERE orders.status != 'Đã hủy'
        GROUP BY product_name
        ORDER BY total_qty DESC
        LIMIT 5
    """)
    top_selling = [dict(r) for r in cursor.fetchall()]

    # If no sales yet, fallback to top products from products table
    if not top_selling:
        cursor.execute("""
            SELECT name as product_name, image as product_image, 0 as total_qty, 0 as total_sales
            FROM products
            LIMIT 5
        """)
        top_selling = [dict(r) for r in cursor.fetchall()]

    # 6. Orders breakdown by status
    cursor.execute("""
        SELECT status, COUNT(*) as cnt
        FROM orders
        GROUP BY status
    """)
    status_breakdown = {r['status']: r['cnt'] for r in cursor.fetchall()}

    return {
        'total_revenue': total_rev,
        'total_orders': total_ord,
        'pending_orders': pending_ord,
        'total_products': total_prod,
        'top_selling': top_selling,
        'status_breakdown': status_breakdown
    }

if __name__ == '__main__':
    init_db()
    print("Database check completed.")
