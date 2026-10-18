"""
Automated Integration Tests for Highlands Coffee Python API
"""

import urllib.request
import urllib.parse
import http.cookiejar
import json
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = 'http://127.0.0.1:5000'

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def request(path, method='GET', data=None):
    url = BASE_URL + path
    headers = {'Content-Type': 'application/json'}
    body = None
    if data is not None:
        body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with opener.open(req) as resp:
            content = resp.read().decode('utf-8')
            return resp.status, json.loads(content) if 'application/json' in resp.headers.get('Content-Type', '') else content
    except urllib.error.HTTPError as e:
        content = e.read().decode('utf-8')
        try:
            return e.code, json.loads(content)
        except:
            return e.code, content

def run_tests():
    print("=== STARTING API TESTS ===")
    
    # 1. Test homepage
    status, html = request('/')
    assert status == 200, f"Expected 200, got {status}"
    assert 'Highlands Coffee' in html, "Homepage missing title"
    print("✓ Test 1: Homepage / returned 200 OK")

    # 2. Test initial auth state
    status, res = request('/api/auth/me')
    assert status == 200 and res.get('authenticated') == False, "Expected unauthenticated"
    print("✓ Test 2: GET /api/auth/me returned unauthenticated")

    # 3. Test login with demo account
    status, res = request('/api/auth/login', 'POST', {'username': 'demo', 'password': '123456'})
    assert status == 200 and res.get('success') == True, f"Login failed: {res}"
    print(f"✓ Test 3: POST /api/auth/login successful for {res['user']['full_name']}")

    # 4. Test auth/me with session
    status, res = request('/api/auth/me')
    assert status == 200 and res.get('authenticated') == True, f"Session failed: {res}"
    print(f"✓ Test 4: GET /api/auth/me returned authenticated user: {res['user']['username']}")

    # 5. Test update profile
    status, res = request('/api/auth/profile', 'PUT', {
        'full_name': 'Nguyễn Văn A (VIP Member)',
        'phone': '0987654321',
        'address': 'Tầng 15, Bitexco Financial Tower, Quận 1, TP.HCM'
    })
    assert status == 200 and res.get('success') == True, f"Update profile failed: {res}"
    assert res['user']['full_name'] == 'Nguyễn Văn A (VIP Member)', "Profile not updated"
    print(f"✓ Test 5: PUT /api/auth/profile updated successfully: {res['user']['address']}")

    # 6. Test change password
    status, res = request('/api/auth/change-password', 'PUT', {
        'old_password': '123456',
        'new_password': 'newpassword123'
    })
    assert status == 200 and res.get('success') == True, f"Change password failed: {res}"
    print("✓ Test 6: PUT /api/auth/change-password succeeded")

    # Revert password back to 123456
    status, res = request('/api/auth/change-password', 'PUT', {
        'old_password': 'newpassword123',
        'new_password': '123456'
    })
    assert status == 200 and res.get('success') == True

    # 7. Test create order in SQLite
    order_data = {
        'order_type': 'delivery',
        'customer_name': 'Nguyễn Văn A (VIP Member)',
        'customer_phone': '0987654321',
        'customer_address': 'Tầng 15, Bitexco, Q1, TP.HCM',
        'customer_note': 'Giao giờ nghỉ trưa',
        'payment_method': 'VIETQR',
        'items': [
            {
                'productId': 30,
                'name': 'TRÀ SEN VÀNG (CỦ NĂNG)',
                'image': 'images/products/HLC_New_logo_5.1_Products__TRA_SEN_VANG_CU_NANG.jpg',
                'size': {'code': 'M', 'name': 'Size Lớn (M)'},
                'sugar': '70%',
                'ice': '100%',
                'toppings': [{'id': 'top_hat_sen', 'name': 'Hạt Sen Thơm Bùi', 'price': 10000}],
                'notes': 'Ít ngọt',
                'unitPrice': 61000,
                'quantity': 2,
                'totalPrice': 122000
            }
        ],
        'subtotal': 122000,
        'discount': 0,
        'shipping_fee': 15000,
        'total_amount': 137000
    }
    status, res = request('/api/orders', 'POST', order_data)
    assert status == 200 and res.get('success') == True, f"Order failed: {res}"
    order_code = res['order']['order_code']
    print(f"✓ Test 7: POST /api/orders created order in SQLite with code: {order_code}")

    # 8. Test get orders for logged in user
    status, res = request('/api/orders')
    assert status == 200 and len(res.get('orders', [])) > 0, f"Get orders failed: {res}"
    latest_order = res['orders'][0]
    assert latest_order['order_code'] == order_code, "Order code mismatch in DB"
    assert len(latest_order['items']) == 1, "Order items missing"
    print(f"✓ Test 8: GET /api/orders retrieved {len(res['orders'])} orders from SQLite")

    # 9. Test get order by code
    status, res = request(f'/api/orders/{order_code}')
    assert status == 200 and res.get('success') == True, f"Get order by code failed: {res}"
    print(f"✓ Test 9: GET /api/orders/{order_code} retrieved full details")

    # 10. Test register new member
    test_user = f"user_{int(time_stamp := __import__('time').time())}"
    status, res = request('/api/auth/register', 'POST', {
        'username': test_user,
        'password': 'password123',
        'full_name': 'Trần Thị B',
        'phone': '0901234567',
        'address': 'Số 456 Hai Bà Trưng, Quận 3'
    })
    assert status == 200 and res.get('success') == True, f"Register failed: {res}"
    print(f"✓ Test 10: POST /api/auth/register created member: {test_user}")

    # 11. Test logout
    status, res = request('/api/auth/logout', 'POST')
    assert status == 200 and res.get('success') == True
    status, res = request('/api/auth/me')
    assert status == 200 and res.get('authenticated') == False
    print("✓ Test 11: POST /api/auth/logout cleared session successfully")

    print("\n🎉 ALL 11 INTEGRATION TESTS PASSED 100%!")

if __name__ == '__main__':
    run_tests()
