"""
Highlands Coffee Web App - Python Dynamic Backend
Flask + SQLite + Admin Dashboard System
"""

import os
import sys
import io
import csv
import json
import random
import re
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, session, send_from_directory, send_file, render_template, redirect, url_for, Response
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from database import get_db, init_db, get_admin_stats

# Configure UTF-8 encoding for standard streams
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

app = Flask(__name__, template_folder='templates', static_folder=None)
app.secret_key = os.environ.get('SECRET_KEY', 'highlands-secret-key-2026-coffee-vietnam')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # 16 MB max upload

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'images', 'products')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Admin credentials
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'highlands123')

# Ensure DB initialized
init_db()

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin'):
            if request.path.startswith('/api/'):
                return jsonify({'success': False, 'message': 'Yêu cầu quyền Quản trị viên!'}), 403
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

# ==========================================
# STATIC FILE SERVING & HOMEPAGE
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
# ADMIN AUTHENTICATION & DASHBOARD PAGES
# ==========================================

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if session.get('is_admin'):
        return redirect('/admin')

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        # Check against ADMIN_USERNAME and ADMIN_PASSWORD or DB admin
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ? AND is_admin = 1", (username,))
        db_admin = cursor.fetchone()
        conn.close()

        is_valid = False
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            is_valid = True
        elif db_admin and check_password_hash(db_admin['password_hash'], password):
            is_valid = True

        if is_valid:
            session['is_admin'] = True
            session['admin_username'] = username
            return redirect('/admin')
        else:
            return render_template('admin_login.html', error='Tên đăng nhập hoặc mật khẩu quản trị không đúng!')

    return render_template('admin_login.html')

@app.route('/admin/logout')
def admin_logout():
    session.pop('is_admin', None)
    session.pop('admin_username', None)
    return redirect('/admin/login')

@app.route('/admin')
@admin_required
def admin_dashboard():
    return render_template('admin.html')


# ==========================================
# ADMIN APIS: STATS & DASHBOARD
# ==========================================

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def admin_stats():
    conn = get_db()
    stats = get_admin_stats(conn)
    conn.close()
    return jsonify({'success': True, 'stats': stats})


# ==========================================
# ADMIN APIS: ORDERS MANAGEMENT
# ==========================================

@app.route('/api/admin/orders', methods=['GET'])
@admin_required
def admin_get_orders():
    status = request.args.get('status', '').strip()
    search = request.args.get('search', '').strip()

    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM orders WHERE 1=1"
    params = []

    if status and status != 'ALL':
        query += " AND status = ?"
        params.append(status)

    if search:
        query += " AND (order_code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    query += " ORDER BY id DESC"
    cursor.execute(query, params)
    orders_raw = cursor.fetchall()

    orders = []
    for ord_row in orders_raw:
        ord_dict = dict(ord_row)
        cursor.execute("SELECT * FROM order_items WHERE order_id = ?", (ord_dict['id'],))
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

@app.route('/api/admin/orders/<int:order_id>/status', methods=['PUT'])
@admin_required
def admin_update_order_status(order_id):
    data = request.get_json() or {}
    new_status = data.get('status', '').strip()

    valid_statuses = ['Chờ xác nhận', 'Đang pha chế', 'Đang giao hàng', 'Hoàn thành', 'Đã hủy']
    if new_status not in valid_statuses:
        return jsonify({'success': False, 'message': 'Trạng thái không hợp lệ!'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': f'Đã cập nhật đơn sang trạng thái "{new_status}"'})


# ==========================================
# ADMIN APIS: MENU CRUD & PRODUCTS
# ==========================================

@app.route('/api/admin/products', methods=['GET'])
@admin_required
def admin_get_products():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.id DESC
    """)
    products = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'products': products})

@app.route('/api/admin/products', methods=['POST'])
@admin_required
def admin_create_product():
    name = request.form.get('name', '').strip()
    category_id = int(request.form.get('category_id', 1))
    price = int(request.form.get('price', 0))
    description = request.form.get('description', '').strip()
    is_available = int(request.form.get('is_available', 1))

    if not name or price <= 0:
        return jsonify({'success': False, 'message': 'Vui lòng nhập tên món và giá tiền hợp lệ!'}), 400

    image_path = 'images/products/Phin_Den_Da.jpg' # default fallback

    # Check file upload
    if 'image_file' in request.files and request.files['image_file'].filename:
        file = request.files['image_file']
        filename = secure_filename(file.filename)
        # Avoid collision
        unique_name = f"item_{int(datetime.now().timestamp())}_{filename}"
        target_path = os.path.join(UPLOAD_FOLDER, unique_name)
        file.save(target_path)
        image_path = f"images/products/{unique_name}"
    elif request.form.get('image_url'):
        image_path = request.form.get('image_url').strip()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO products (name, category_id, price, description, image, is_available)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (name, category_id, price, description, image_path, is_available))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return jsonify({'success': True, 'message': 'Đã thêm món mới vào thực đơn thành công!', 'id': new_id})

@app.route('/api/admin/products/<int:product_id>', methods=['PUT'])
@admin_required
def admin_update_product(product_id):
    name = request.form.get('name', '').strip()
    category_id = int(request.form.get('category_id', 1))
    price = int(request.form.get('price', 0))
    description = request.form.get('description', '').strip()
    is_available = int(request.form.get('is_available', 1))

    if not name or price <= 0:
        return jsonify({'success': False, 'message': 'Vui lòng nhập tên món và giá tiền hợp lệ!'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT image FROM products WHERE id = ?", (product_id,))
    curr = cursor.fetchone()
    if not curr:
        conn.close()
        return jsonify({'success': False, 'message': 'Không tìm thấy sản phẩm!'}), 404

    image_path = curr['image']

    if 'image_file' in request.files and request.files['image_file'].filename:
        file = request.files['image_file']
        filename = secure_filename(file.filename)
        unique_name = f"item_{int(datetime.now().timestamp())}_{filename}"
        target_path = os.path.join(UPLOAD_FOLDER, unique_name)
        file.save(target_path)
        image_path = f"images/products/{unique_name}"
    elif request.form.get('image_url'):
        image_path = request.form.get('image_url').strip()

    cursor.execute("""
        UPDATE products 
        SET name = ?, category_id = ?, price = ?, description = ?, image = ?, is_available = ?
        WHERE id = ?
    """, (name, category_id, price, description, image_path, is_available, product_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Cập nhật món thành công!'})

@app.route('/api/admin/products/<int:product_id>', methods=['DELETE'])
@admin_required
def admin_delete_product(product_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Đã xóa món khỏi thực đơn!'})

@app.route('/api/admin/products/<int:product_id>/toggle-stock', methods=['PUT'])
@admin_required
def admin_toggle_stock(product_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT is_available FROM products WHERE id = ?", (product_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'Không tìm thấy sản phẩm'}), 404

    new_val = 0 if row['is_available'] == 1 else 1
    cursor.execute("UPDATE products SET is_available = ? WHERE id = ?", (new_val, product_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'is_available': new_val})


# ==========================================
# ADMIN APIS: IMPORT & EXPORT EXCEL / CSV
# ==========================================

@app.route('/api/admin/export/menu')
@admin_required
def export_menu_csv():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.id, p.name, p.price, c.name as category_name, p.category_id, p.is_available, p.description, p.image
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.id ASC
    """)
    products = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    # Write UTF-8 BOM for Microsoft Excel
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(['Mã ID', 'Tên Món', 'Giá Tiền (VNĐ)', 'Danh Mục', 'Mã Danh Mục', 'Còn Hàng (1: Có, 0: Hết)', 'Mô Tả', 'Đường Dẫn Ảnh'])

    for p in products:
        writer.writerow([
            p['id'],
            p['name'],
            p['price'],
            p['category_name'] or '',
            p['category_id'],
            p['is_available'],
            p['description'] or '',
            p['image']
        ])

    csv_data = output.getvalue()
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=highlands_menu.csv'}
    )

@app.route('/api/admin/export/orders')
@admin_required
def export_orders_csv():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders ORDER BY id DESC")
    orders = cursor.fetchall()

    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow([
        'Mã Đơn Hàng', 'Thời Gian Đặt', 'Khách Hàng', 'Số Điện Thoại', 'Địa Chỉ Giao Hàng',
        'Hình Thức', 'Phương Thức Thanh Toán', 'Tạm Tính', 'Giảm Giá', 'Phí Vận Chuyển',
        'Tổng Tiền (VNĐ)', 'Trạng Thái', 'Chi Tiết Món'
    ])

    for o in orders:
        cursor.execute("SELECT product_name, quantity, unit_price FROM order_items WHERE order_id = ?", (o['id'],))
        items = cursor.fetchall()
        items_str = "; ".join([f"{it['quantity']}x {it['product_name']} ({it['unit_price']}đ)" for it in items])

        writer.writerow([
            o['order_code'],
            o['created_at'],
            o['customer_name'],
            o['customer_phone'],
            o['customer_address'],
            o['order_type'],
            o['payment_method'],
            o['subtotal'],
            o['discount'],
            o['shipping_fee'],
            o['total_amount'],
            o['status'],
            items_str
        ])

    conn.close()
    csv_data = output.getvalue()
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=highlands_orders.csv'}
    )

@app.route('/api/admin/import/menu', methods=['POST'])
@admin_required
def import_menu_csv():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'Không tìm thấy file tải lên!'}), 400

    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({'success': False, 'message': 'Vui lòng chọn file định dạng .CSV!'}), 400

    try:
        content = file.stream.read().decode('utf-8-sig', errors='replace')
        stream = io.StringIO(content)
        reader = csv.reader(stream)
        headers = next(reader, None)

        conn = get_db()
        cursor = conn.cursor()

        updated_count = 0
        inserted_count = 0

        for row in reader:
            if not row or len(row) < 3:
                continue

            raw_id = row[0].strip()
            name = row[1].strip()
            price_str = row[2].strip()
            price = int(price_str) if price_str.isdigit() else 0

            cat_id = 1
            if len(row) > 4 and row[4].strip().isdigit():
                cat_id = int(row[4].strip())

            is_available = 1
            if len(row) > 5 and row[5].strip() in ('0', '1'):
                is_available = int(row[5].strip())

            desc = row[6].strip() if len(row) > 6 else ''
            img = row[7].strip() if len(row) > 7 and row[7].strip() else 'images/products/Phin_Den_Da.jpg'

            if raw_id and raw_id.isdigit():
                p_id = int(raw_id)
                cursor.execute("SELECT id FROM products WHERE id = ?", (p_id,))
                if cursor.fetchone():
                    cursor.execute("""
                        UPDATE products
                        SET name = ?, price = ?, category_id = ?, is_available = ?, description = ?
                        WHERE id = ?
                    """, (name, price, cat_id, is_available, desc, p_id))
                    updated_count += 1
                    continue

            # Insert new
            cursor.execute("""
                INSERT INTO products (name, category_id, price, description, image, is_available)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (name, cat_id, price, desc, img, is_available))
            inserted_count += 1

        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'updated_count': updated_count,
            'inserted_count': inserted_count
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Lỗi xử lý file CSV: {str(e)}'}), 500


# ==========================================
# STOREFRONT CLIENT APIS
# ==========================================

@app.route('/api/products', methods=['GET'])
def get_store_products():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.id ASC
    """)
    products = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'products': products})

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

    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': f'Tài khoản "{username}" đã tồn tại trên hệ thống!'}), 409

    pwd_hash = generate_password_hash(password)
    cursor.execute("""
    INSERT INTO users (username, password_hash, full_name, phone, address, is_admin)
    VALUES (?, ?, ?, ?, ?, 0)
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
    cursor.execute("SELECT id, username, password_hash, full_name, phone, address, is_admin FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'success': False, 'message': 'Tên đăng nhập hoặc mật khẩu không chính xác!'}), 401

    session['user_id'] = user['id']
    if user['is_admin']:
        session['is_admin'] = True
        session['admin_username'] = user['username']

    return jsonify({
        'success': True,
        'message': f'Chào mừng {user["full_name"]} đã quay trở lại Highlands Coffee!',
        'user': {
            'id': user['id'],
            'username': user['username'],
            'full_name': user['full_name'],
            'phone': user['phone'],
            'address': user['address'],
            'is_admin': bool(user['is_admin'])
        }
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('is_admin', None)
    session.pop('admin_username', None)
    return jsonify({'success': True, 'message': 'Đã đăng xuất thành công!'})

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'authenticated': False, 'user': None})

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, full_name, phone, address, is_admin, created_at FROM users WHERE id = ?", (user_id,))
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
            'is_admin': bool(user['is_admin']),
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

    cursor.execute("SELECT id, username, full_name, phone, address, is_admin FROM users WHERE id = ?", (user_id,))
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

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.get_json() or {}
    user_id = session.get('user_id')

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

    order_code = f"HL-{random.randint(100000, 999999)}"

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
        INSERT INTO orders (
            order_code, user_id, order_type, customer_name, customer_phone,
            customer_address, customer_note, payment_method, subtotal,
            discount, shipping_fee, total_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Chờ xác nhận')
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
        cursor.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", (user_id,))
    elif phone:
        cursor.execute("SELECT * FROM orders WHERE customer_phone = ? ORDER BY id DESC", (phone,))
    else:
        conn.close()
        return jsonify({'success': True, 'orders': []})

    orders_raw = cursor.fetchall()
    orders = []

    for ord_row in orders_raw:
        ord_dict = dict(ord_row)
        cursor.execute("SELECT * FROM order_items WHERE order_id = ?", (ord_dict['id'],))
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
    print(f"Highlands Coffee Python Flask server starting on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
