# ☕ Highlands Coffee - Web Ordering & E-Menu (Web Đặt Đồ Uống Trực Tuyến)

Ứng dụng web đặt đồ uống (E-Menu & Web Ordering) lấy cảm hứng từ nhận diện thương hiệu **Highlands Coffee** Việt Nam, được phát triển thành **Web Động** với backend bằng **Python (Flask)** và cơ sở dữ liệu **SQLite**.

> *Lưu ý: Ảnh sản phẩm thuộc bản quyền chủ sở hữu – trang dùng cho mục đích học tập, không phát hành.*

---

## 🌟 Tính Năng Nổi Bật

### 1. Khách hàng & Giao diện (Frontend)
- **Highlands Coffee Theme**: Thiết kế hiện đại, bảng màu chuẩn đỏ trầm (`#B22830`), nâu cà phê (`#53382C`), nền kem (`#FAF6F0`) và vàng đồng (`#D4AF37`).
- **Responsive**: Trải nghiệm mượt mà như app di động và trực quan trên máy tính.
- **Tìm kiếm thông minh**: Hỗ trợ tìm kiếm tiếng Việt có dấu và không dấu (gõ *"tra sen"*, *"phin sua"* ra ngay).
- **Phân loại danh mục (Catalog)**: Tự động trích xuất danh mục (*Cà phê, PhinDi, Freeze, Trà, Bánh ngọt*), lọc món bán chạy, sắp xếp giá.
- **Tùy biến đồ uống chuẩn quán (Drink Customization)**:
  - Chọn kích cỡ (Size S, M +6k, L +10k).
  - Chọn mức đường (100%, 70%, 50%, 30%, 0%).
  - Chọn mức đá (100%, 70%, 50%, Đá riêng, Không đá / Nóng).
  - Thêm Topping phong phú (Thạch cà phê, Kem phô mai Macchiato, Hạt sen, Củ năng, Thạch đào, Sốt caramel, Shot espresso).
  - Ghi chú riêng cho Barista.
  - Tự động tính giá real-time.
- **Giỏ hàng trượt (Slide-over Cart)**: Thanh tiến trình Freeship từ 150.000đ, áp dụng mã voucher (`HIGHLANDS20`, `FREESHIP`, `HL10`).
- **Thanh toán & Hóa đơn**: Hỗ trợ giao tận nơi hoặc nhận tại quán, phương thức thanh toán COD, chuyển khoản VietQR kèm mã QR động, in hóa đơn.

### 2. Quản lý Thành Viên & Cơ Sở Dữ Liệu (Backend & SQLite)
- **Đăng ký / Đăng nhập thành viên**: Mật khẩu được băm bảo mật bằng thuật toán Werkzeug PBKDF2/SHA-256.
- **Tài khoản demo có sẵn**: `demo` / `123456`.
- **Quản lý thông tin cá nhân**: Cập nhật Họ và tên, Số điện thoại, Địa chỉ giao hàng mặc định, Đổi mật khẩu.
- **Quản lý đơn hàng (Order History)**: Toàn bộ đơn hàng được lưu trữ bền vững trong SQLite (`orders` và `order_items`), liên kết trực tiếp với tài khoản người dùng.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend**: Python 3 (Flask)
- **Database**: SQLite (`database/coffeeshop.db`)
- **Frontend**: HTML5, Tailwind CSS, Google Fonts (Plus Jakarta Sans, Montserrat), Lucide Icons
- **Data Source**: 46 sản phẩm và 4 danh mục từ file CSV

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Yêu cầu:
- Đã cài đặt **Python 3.10+**

### Các bước khởi chạy cục bộ (Local):

1. **Cài đặt thư viện phụ thuộc:**
```bash
pip install -r requirements.txt
```

2. **Chạy máy chủ web:**
```bash
python app.py
```
*Hoặc trên Windows, bạn chỉ cần nhấp đúp vào file `run_app.bat`.*

3. **Truy cập ứng dụng:**
Mở trình duyệt và truy cập: **`http://localhost:5000`**

---

## ☁️ Hướng Dẫn Deploy Lên Render (Web Service)

1. Tạo mới **Web Service** trên [Render Dashboard](https://dashboard.render.com).
2. Kết nối với repository GitHub: `https://github.com/tbn11906-ai/CoffeeShop`.
3. Cấu hình các thông số:
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
4. Bấm **Deploy Web Service**.

---

## 📁 Cấu Trúc Dự Án

```
CoffeeShop/
├── app.py                # Backend Flask server & REST API
├── database.py           # Kết nối & tạo bảng SQLite (users, orders, products...)
├── run_app.bat           # File khởi chạy nhanh 1-click cho Windows
├── index.html            # Giao diện chính hoàn chỉnh
├── css/
│   └── style.css         # Custom styles, animations Highlands
├── js/
│   ├── data.js           # Dữ liệu sản phẩm & danh mục
│   └── app.js            # Logic frontend SPA & gọi API backend
├── database/
│   └── coffeeshop.db     # Cơ sở dữ liệu SQLite
├── data/
│   ├── category.csv      # Dữ liệu danh mục gốc
│   └── product.csv       # Dữ liệu 46 sản phẩm gốc
├── images/
│   └── products/         # 46 hình ảnh sản phẩm
└── scripts/
    ├── inspect.js        # Script kiểm tra dữ liệu
    ├── build_data.js     # Script build data.js
    └── test_api.py       # Bộ kiểm thử tự động 11 API
```
