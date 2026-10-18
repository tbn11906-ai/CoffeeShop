"""
Highlands Coffee Web App - Python Dynamic Backend
Flask + SQLite
"""

import os
import sys
import json
import random
import re
from datetime import datetime
from flask import Flask, request, jsonify, session, send_from_directory, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db, init_db

# Configure UTF-8 encoding for standard streams
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get('SECRET_KEY', 'highlands-secret-key-2026-coffee-vietnam')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Ensure DB initialized
init_db()

# ==========================================
# STATIC FILE SERVING
# ==========================================

@app.route('/')
def index():
    return send_file(os.path.join(BASE_DIR, 'index.html'))

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'css'), filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'js'), filename)

@app.route('/images/<path:filename>')
def serve_images(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'images'), filename)

@app.route('/data/<path:filename>')
def serve_data(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'data'), filename)


# ==========================================
# AUTHENTICATION APIS
# ==========================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')
    full_name = data.get('full_name', '').strip()
    phone = data.get('phone', '').strip()
    address = data.get('address', '').strip()

    if not username or len(username) < 3:
        return jsonify({'success': False, 'message': 'Tên đăng nhập phải có ít nhất 3 ký tự!'}), 400

    if not re.match(r'^[a-zA-Z0-9_.-]+$', username):
        return jsonify({'success': False, 'message': 'Tên đăng nhập chỉ chứa chữ cái, số, gạch dưới hoặc chấm!'}), 400

    if not password or len(password) < 6:
        return jsonify({'success': False, 'message': 'Mật khẩu phải có ít nhất 6 ký tự!'}), 400

    if not full_name:
        return jsonify({'success': False, 'message': 'Vui lòng nhập họ và tên!'}), 400

    if not phone or not re.match(r'^(0[35789])[0-9]{8}$', phone):
        return jsonify({'success': False, 'message': 'Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)!'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Check existing user
    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': f'Tài khoản "{username}" đã tồn tại trên hệ thống!'}), 409

    pwd_hash = generate_password_hash(password)
    cursor.execute("""
    INSERT INTO users (username, password_hash, full_name, phone, address)
    VALUES (?, ?, ?, ?, ?)
    """, (username, pwd_hash, full_name, phone, address))
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()

    session['user_id'] = user_id

    return jsonify({
        'success': True,
        'message': 'Đăng ký thành viên thành công!',
        'user': {
            'id': user_id,
            'username': username,
            'full_name': full_name,
            'phone': phone,
            'address': address
        }
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'success': False, 'message': 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash, full_name, phone, address FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'success': False, 'message': 'Tên đăng nhập hoặc mật khẩu không chính xác!'}), 401

    session['user_id'] = user['id']

    return jsonify({
        'success': True,
        'message': f'Chào mừng {user["full_name"]} đã quay trở lại Highlands Coffee!',
        'user': {
            'id': user['id'],
            'username': user['username'],
            'full_name': user['full_name'],
            'phone': user['phone'],
            'address': user['address']
        }
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'success': True, 'message': 'Đã đăng xuất thành công!'})

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'authenticated': False, 'user': None})

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, full_name, phone, address, created_at FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        session.pop('user_id', None)
        return jsonify({'authenticated': False, 'user': None})

    return jsonify({
        'authenticated': True,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'full_name': user['full_name'],
            'phone': user['phone'],
            'address': user['address'],
            'created_at': user['created_at']
        }
    })

@app.route('/api/auth/profile', methods=['PUT'])
def update_profile():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập trước khi cập nhật thông tin!'}), 401

    data = request.get_json() or {}
    full_name = data.get('full_name', '').strip()
    phone = data.get('phone', '').strip()
    address = data.get('address', '').strip()

    if not full_name:
        return jsonify({'success': False, 'message': 'Họ và tên không được để trống!'}), 400

    if not phone or not re.match(r'^(0[35789])[0-9]{8}$', phone):
        return jsonify({'success': False, 'message': 'Số điện thoại không hợp lệ (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)!'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE users 
    SET full_name = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (full_name, phone, address, user_id))
    conn.commit()

    cursor.execute("SELECT id, username, full_name, phone, address FROM users WHERE id = ?", (user_id,))
    updated_user = cursor.fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Cập nhật thông tin cá nhân thành công!',
        'user': dict(updated_user)
    })

@app.route('/api/auth/change-password', methods=['PUT'])
def change_password():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Vui lòng đăng nhập để đổi mật khẩu!'}), 401

    data = request.get_json() or {}
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')

    if not old_password or not new_password:
        return jsonify({'success': False, 'message': 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới!'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'message': 'Mật khẩu mới phải có ít nhất 6 ký tự!'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()

    if not user or not check_password_hash(user['password_hash'], old_password):
        conn.close()
        return jsonify({'success': False, 'message': 'Mật khẩu hiện tại không chính xác!'}), 400

    new_hash = generate_password_hash(new_password)
    cursor.execute("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_hash, user_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Đổi mật khẩu thành công!'})


# ==========================================
# ORDERS APIS
# ==========================================

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.get_json() or {}
    user_id = session.get('user_id') # None if guest

    order_type = data.get('order_type', 'delivery')
    customer_name = data.get('customer_name', '').strip()
    customer_phone = data.get('customer_phone', '').strip()
    customer_address = data.get('customer_address', '').strip()
    customer_note = data.get('customer_note', '').strip()
    payment_method = data.get('payment_method', 'COD')
    items = data.get('items', [])
    subtotal = int(data.get('subtotal', 0))
    discount = int(data.get('discount', 0))
    shipping_fee = int(data.get('shipping_fee', 0))
    total_amount = int(data.get('total_amount', 0))

    if not customer_name or not customer_phone:
        return jsonify({'success': False, 'message': 'Vui lòng nhập họ tên và số điện thoại!'}), 400

    if not items or len(items) == 0:
        return jsonify({'success': False, 'message': 'Giỏ hàng đang trống!'}), 400

    # Generate unique order code
    order_code = f"HL-{random.randint(100000, 999999)}"

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
        INSERT INTO orders (
            order_code, user_id, order_type, customer_name, customer_phone,
            customer_address, customer_note, payment_method, subtotal,
            discount, shipping_fee, total_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Đang chuẩn bị')
        """, (
            order_code, user_id, order_type, customer_name, customer_phone,
            customer_address, customer_note, payment_method, subtotal,
            discount, shipping_fee, total_amount
        ))

        order_id = cursor.lastrowid

        for item in items:
            toppings_str = json.dumps(item.get('toppings', []), ensure_ascii=False)
            cursor.execute("""
            INSERT INTO order_items (
                order_id, product_id, product_name, product_image, size_code,
                size_name, sugar_level, ice_level, toppings_json, notes,
                unit_price, quantity, total_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                order_id,
                item.get('productId'),
                item.get('name', ''),
                item.get('image', ''),
                item.get('size', {}).get('code', '') if isinstance(item.get('size'), dict) else '',
                item.get('size', {}).get('name', '') if isinstance(item.get('size'), dict) else '',
                item.get('sugar', ''),
                item.get('ice', ''),
                toppings_str,
                item.get('notes', ''),
                item.get('unitPrice', 0),
                item.get('quantity', 1),
                item.get('totalPrice', 0)
            ))

        conn.commit()

        # Query created order details
        cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        created_order = dict(cursor.fetchone())
        created_order['items'] = items

        conn.close()

        return jsonify({
            'success': True,
            'message': 'Đặt hàng thành công!',
            'order': created_order
        })

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'success': False, 'message': f'Lỗi tạo đơn hàng: {str(e)}'}), 500

@app.route('/api/orders', methods=['GET'])
def get_orders():
    user_id = session.get('user_id')
    phone = request.args.get('phone', '').strip()

    conn = get_db()
    cursor = conn.cursor()

    if user_id:
        cursor.execute("""
        SELECT * FROM orders 
        WHERE user_id = ? 
        ORDER BY id DESC
        """, (user_id,))
    elif phone:
        cursor.execute("""
        SELECT * FROM orders 
        WHERE customer_phone = ? 
        ORDER BY id DESC
        """, (phone,))
    else:
        conn.close()
        return jsonify({'success': True, 'orders': []})

    orders_raw = cursor.fetchall()
    orders = []

    for ord_row in orders_raw:
        ord_dict = dict(ord_row)
        cursor.execute("""
        SELECT * FROM order_items WHERE order_id = ?
        """, (ord_dict['id'],))
        items_raw = cursor.fetchall()
        items = []
        for it in items_raw:
            it_dict = dict(it)
            try:
                it_dict['toppings'] = json.loads(it_dict['toppings_json'])
            except:
                it_dict['toppings'] = []
            it_dict['size'] = {'code': it_dict['size_code'], 'name': it_dict['size_name']}
            items.append(it_dict)

        ord_dict['items'] = items
        orders.append(ord_dict)

    conn.close()
    return jsonify({'success': True, 'orders': orders})

@app.route('/api/orders/<order_code>', methods=['GET'])
def get_order_by_code(order_code):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE order_code = ?", (order_code,))
    order_row = cursor.fetchone()

    if not order_row:
        conn.close()
        return jsonify({'success': False, 'message': 'Không tìm thấy đơn hàng!'}), 404

    order_dict = dict(order_row)
    cursor.execute("SELECT * FROM order_items WHERE order_id = ?", (order_dict['id'],))
    items_raw = cursor.fetchall()
    items = []
    for it in items_raw:
        it_dict = dict(it)
        try:
            it_dict['toppings'] = json.loads(it_dict['toppings_json'])
        except:
            it_dict['toppings'] = []
        it_dict['size'] = {'code': it_dict['size_code'], 'name': it_dict['size_name']}
        items.append(it_dict)

    order_dict['items'] = items
    conn.close()

    return jsonify({'success': True, 'order': order_dict})

# ==========================================
# RUN APP
# ==========================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Highlands Coffee Python Flask server starting on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
