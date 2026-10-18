/**
 * Highlands Coffee - Web Ordering & E-Menu Application
 * Dynamic Single Page Application with Python Flask & SQLite Backend
 */

(function () {
  'use strict';

  // Helper: Strip Vietnamese diacritics for smart search
  function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
    str = str.replace(/ì|í|ỉ|ĩ/g, 'i');
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
    str = str.replace(/đ/g, 'd');
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, '');
    str = str.replace(/\u02C6|\u0306|\u031B/g, '');
    return str.trim();
  }

  // Helper: Format currency to VNĐ
  function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  }

  // App Main State
  const state = {
    categories: [],
    products: [],
    toppings: [],
    currentCategory: 0, // 0 = all
    currentTag: null,
    searchQuery: '',
    currentSort: 'default',
    
    // Auth & User State
    currentUser: null,

    // Cart
    cart: [],
    voucher: null,
    orderType: 'delivery', // 'delivery' | 'takeaway'
    
    // Active customize modal
    customizingProduct: null,
    modalForm: {
      size: null,
      sugar: '100%',
      ice: '100%',
      toppings: [],
      notes: '',
      quantity: 1
    },

    // Hero slideshow
    heroSlideIndex: 0,
    heroTimer: null,
    heroSlides: [
      {
        id: 30,
        title: 'TRÀ SEN VÀNG (CỦ NĂNG)',
        category: 'Trà Highlands',
        desc: 'Thức uống chinh phục những thực khách khó tính! Sự kết hợp độc đáo giữa trà Ô long, hạt sen thơm bùi và củ năng giòn tan.',
        price: 45000,
        image: 'images/products/HLC_New_logo_5.1_Products__TRA_SEN_VANG_CU_NANG.jpg'
      },
      {
        id: 13,
        title: 'PHINDI KEM SỮA',
        category: 'PhinDi Cà Phê',
        desc: 'PhinDi Kem Sữa - Cà phê Phin thế hệ mới với chất Phin êm dịu, kết hợp cùng Kem Sữa béo ngậy mang đến trải nghiệm hiện đại!',
        price: 45000,
        image: 'images/products/HLC_New_logo_5.1_Products__PHINDI_KEM_SUA.jpg'
      },
      {
        id: 28,
        title: 'FREEZE TRÀ XANH',
        category: 'Freeze Đá Xay',
        desc: 'Trà xanh thượng hạng từ cao nguyên Việt Nam, kết hợp cùng đá xay mát lạnh, thạch trà dai dai và lớp kem tươi thơm béo.',
        price: 55000,
        image: 'images/products/HLC_New_logo_5.1_Products__FREEZE_TRA_XANH.jpg'
      },
      {
        id: 7,
        title: 'PHIN SỮA ĐÁ',
        category: 'Cà phê Phin',
        desc: 'Từng hạt cà phê hảo hạng chọn bằng tay, phối trộn giữa Robusta và Arabica, chiết xuất từ Phin truyền thống hoà cùng sữa đặc sánh mịn.',
        price: 29000,
        image: 'images/products/HLC_New_logo_5.1_Products__PHIN_SUADA.jpg'
      }
    ]
  };

  // Main Application Object
  window.app = {
    init: function () {
      if (!window.HIGHLANDS_DATA) {
        console.error('Data not loaded from js/data.js');
        return;
      }

      state.categories = window.HIGHLANDS_DATA.categories || [];
      state.products = window.HIGHLANDS_DATA.products || [];
      state.toppings = window.HIGHLANDS_DATA.toppings || [];

      // Load cart from localStorage
      try {
        const savedCart = localStorage.getItem('hl_cart');
        if (savedCart) {
          state.cart = JSON.parse(savedCart);
        }
      } catch (e) {
        console.warn('Failed to parse saved cart', e);
      }

      this.renderCategories();
      this.renderProducts();
      this.updateCartBadge();
      this.initHero();
      this.checkAuth();

      // Setup escape key to close modals
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeCustomizeModal();
          this.toggleCart(false);
          this.closeCheckoutModal();
          this.closeReceiptModal();
          this.closeOrderHistory();
          this.closeAuthModal();
          this.closeProfileModal();
        }
      });
    },

    // ==========================================
    // AUTHENTICATION & USER MANAGEMENT
    // ==========================================
    checkAuth: async function () {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
          state.currentUser = data.user;
        } else {
          state.currentUser = null;
        }
      } catch (err) {
        console.warn('Auth check skipped (offline or static mode)', err);
        state.currentUser = null;
      }
      this.renderAuthHeader();
    },

    renderAuthHeader: function () {
      const container = document.getElementById('authHeaderContainer');
      if (!container) return;

      if (state.currentUser) {
        const initials = state.currentUser.full_name
          ? state.currentUser.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
          : 'HL';

        container.innerHTML = `
          <div class="relative group" id="userMenuDropdown">
            <button class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-stone-800 rounded-full font-bold text-xs border border-amber-300 shadow-sm transition-all">
              <span class="w-6 h-6 rounded-full bg-hl-red text-white flex items-center justify-center text-[10px] font-black shrink-0">
                ${initials}
              </span>
              <span class="max-w-[90px] sm:max-w-[120px] truncate hidden sm:inline">${state.currentUser.full_name}</span>
              <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-stone-500"></i>
            </button>

            <!-- Dropdown Menu -->
            <div class="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-stone-200 py-2 hidden group-hover:block z-50 animate-fadeIn">
              <div class="px-4 py-2 border-b border-stone-100">
                <p class="text-[11px] text-stone-400">Đăng nhập với tư cách</p>
                <p class="font-bold text-stone-800 text-xs truncate">${state.currentUser.full_name}</p>
                <p class="text-[10px] text-hl-gold-dark font-mono truncate">@${state.currentUser.username}</p>
              </div>

              <button 
                onclick="app.openProfileModal('info')" 
                class="w-full text-left px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-red-50 hover:text-hl-red flex items-center gap-2 transition-colors"
              >
                <i data-lucide="user" class="w-4 h-4 text-hl-red"></i> Thông tin cá nhân
              </button>

              <button 
                onclick="app.openOrderHistory()" 
                class="w-full text-left px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-red-50 hover:text-hl-red flex items-center gap-2 transition-colors"
              >
                <i data-lucide="receipt" class="w-4 h-4 text-amber-600"></i> Đơn hàng của tôi
              </button>

              <button 
                onclick="app.openProfileModal('password')" 
                class="w-full text-left px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-red-50 hover:text-hl-red flex items-center gap-2 transition-colors"
              >
                <i data-lucide="key-round" class="w-4 h-4 text-blue-600"></i> Đổi mật khẩu
              </button>

              <div class="border-t border-stone-100 my-1"></div>

              <button 
                onclick="app.logout()" 
                class="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
              >
                <i data-lucide="log-out" class="w-4 h-4"></i> Đăng xuất
              </button>
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <button 
            onclick="app.openAuthModal('login')" 
            class="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-white hover:text-hl-red text-stone-800 rounded-full font-bold text-xs transition-all border border-stone-200 shadow-sm"
          >
            <i data-lucide="user" class="w-4 h-4 text-hl-red"></i>
            <span>Đăng nhập</span>
          </button>
        `;
      }

      if (window.lucide) lucide.createIcons();
    },

    openAuthModal: function (tab = 'login') {
      const modal = document.getElementById('authModal');
      if (!modal) return;
      this.switchAuthTab(tab);
      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
      }, 10);
      if (window.lucide) lucide.createIcons();
    },

    closeAuthModal: function () {
      const modal = document.getElementById('authModal');
      if (!modal) return;
      modal.classList.add('opacity-0');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    },

    switchAuthTab: function (tab) {
      const loginForm = document.getElementById('loginForm');
      const regForm = document.getElementById('registerForm');
      const tabLogin = document.getElementById('tabBtnLogin');
      const tabReg = document.getElementById('tabBtnRegister');
      const title = document.getElementById('authModalTitle');

      if (tab === 'login') {
        if (loginForm) loginForm.classList.remove('hidden');
        if (regForm) regForm.classList.add('hidden');
        if (tabLogin) tabLogin.className = 'py-3 text-center border-b-2 border-hl-red text-hl-red bg-white transition-all font-bold';
        if (tabReg) tabReg.className = 'py-3 text-center border-b-2 border-transparent text-stone-500 hover:text-stone-800 transition-all font-bold';
        if (title) title.textContent = 'Đăng Nhập Thành Viên';
      } else {
        if (loginForm) loginForm.classList.add('hidden');
        if (regForm) regForm.classList.remove('hidden');
        if (tabReg) tabReg.className = 'py-3 text-center border-b-2 border-hl-red text-hl-red bg-white transition-all font-bold';
        if (tabLogin) tabLogin.className = 'py-3 text-center border-b-2 border-transparent text-stone-500 hover:text-stone-800 transition-all font-bold';
        if (title) title.textContent = 'Đăng Ký Thành Viên';
      }
    },

    fillDemoAccount: function () {
      const u = document.getElementById('loginUsername');
      const p = document.getElementById('loginPassword');
      if (u) u.value = 'demo';
      if (p) p.value = '123456';
    },

    handleLoginSubmit: async function (e) {
      e.preventDefault();
      const username = document.getElementById('loginUsername')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;

      if (!username || !password) {
        this.showToast('Vui lòng nhập tên đăng nhập và mật khẩu!', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success && data.user) {
          state.currentUser = data.user;
          this.renderAuthHeader();
          this.closeAuthModal();
          this.showToast(data.message || 'Đăng nhập thành công!', 'success');
        } else {
          this.showToast(data.message || 'Đăng nhập thất bại!', 'warning');
        }
      } catch (err) {
        console.error('Login error', err);
        this.showToast('Lỗi kết nối máy chủ!', 'warning');
      }
    },

    handleRegisterSubmit: async function (e) {
      e.preventDefault();
      const username = document.getElementById('regUsername')?.value.trim();
      const password = document.getElementById('regPassword')?.value;
      const full_name = document.getElementById('regFullName')?.value.trim();
      const phone = document.getElementById('regPhone')?.value.trim();
      const address = document.getElementById('regAddress')?.value.trim();

      if (!username || !password || !full_name || !phone) {
        this.showToast('Vui lòng điền đầy đủ các mục bắt buộc (*)!', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, full_name, phone, address })
        });
        const data = await res.json();

        if (data.success && data.user) {
          state.currentUser = data.user;
          this.renderAuthHeader();
          this.closeAuthModal();
          this.showToast('Chào mừng thành viên mới: ' + data.user.full_name, 'success');
        } else {
          this.showToast(data.message || 'Đăng ký không thành công!', 'warning');
        }
      } catch (err) {
        console.error('Register error', err);
        this.showToast('Lỗi kết nối máy chủ!', 'warning');
      }
    },

    logout: async function () {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        console.warn(err);
      }
      state.currentUser = null;
      this.renderAuthHeader();
      this.showToast('Bạn đã đăng xuất tài khoản.', 'info');
    },

    // ==========================================
    // USER PROFILE & PASSWORD MODAL
    // ==========================================
    openProfileModal: function (tab = 'info') {
      if (!state.currentUser) {
        this.openAuthModal('login');
        return;
      }

      const modal = document.getElementById('profileModal');
      const uEl = document.getElementById('profileUsername');
      const nameEl = document.getElementById('profileFullName');
      const phoneEl = document.getElementById('profilePhone');
      const addrEl = document.getElementById('profileAddress');
      const headName = document.getElementById('profileHeaderName');
      const headUser = document.getElementById('profileHeaderUsername');
      const avatarText = document.getElementById('profileAvatarText');

      if (uEl) uEl.value = state.currentUser.username || '';
      if (nameEl) nameEl.value = state.currentUser.full_name || '';
      if (phoneEl) phoneEl.value = state.currentUser.phone || '';
      if (addrEl) addrEl.value = state.currentUser.address || '';
      if (headName) headName.textContent = state.currentUser.full_name || '';
      if (headUser) headUser.textContent = '@' + (state.currentUser.username || '');
      if (avatarText && state.currentUser.full_name) {
        avatarText.textContent = state.currentUser.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      }

      this.switchProfileTab(tab);

      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
      }, 10);
      if (window.lucide) lucide.createIcons();
    },

    closeProfileModal: function () {
      const modal = document.getElementById('profileModal');
      if (!modal) return;
      modal.classList.add('opacity-0');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    },

    switchProfileTab: function (tab) {
      const infoForm = document.getElementById('profileInfoForm');
      const pwdForm = document.getElementById('profilePasswordForm');
      const tabInfo = document.getElementById('profileTabBtnInfo');
      const tabPwd = document.getElementById('profileTabBtnPassword');

      if (tab === 'info') {
        if (infoForm) infoForm.classList.remove('hidden');
        if (pwdForm) pwdForm.classList.add('hidden');
        if (tabInfo) tabInfo.className = 'py-3 text-center border-b-2 border-hl-red text-hl-red bg-white transition-all font-bold';
        if (tabPwd) tabPwd.className = 'py-3 text-center border-b-2 border-transparent text-stone-500 hover:text-stone-800 transition-all font-bold';
      } else {
        if (infoForm) infoForm.classList.add('hidden');
        if (pwdForm) pwdForm.classList.remove('hidden');
        if (tabPwd) tabPwd.className = 'py-3 text-center border-b-2 border-hl-red text-hl-red bg-white transition-all font-bold';
        if (tabInfo) tabInfo.className = 'py-3 text-center border-b-2 border-transparent text-stone-500 hover:text-stone-800 transition-all font-bold';
      }
    },

    handleUpdateProfile: async function (e) {
      e.preventDefault();
      const full_name = document.getElementById('profileFullName')?.value.trim();
      const phone = document.getElementById('profilePhone')?.value.trim();
      const address = document.getElementById('profileAddress')?.value.trim();

      if (!full_name || !phone) {
        this.showToast('Họ tên và số điện thoại không được để trống!', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name, phone, address })
        });
        const data = await res.json();

        if (data.success && data.user) {
          state.currentUser = data.user;
          this.renderAuthHeader();
          this.showToast('Cập nhật thông tin thành công!', 'success');
          this.closeProfileModal();
        } else {
          this.showToast(data.message || 'Cập nhật thất bại!', 'warning');
        }
      } catch (err) {
        console.error('Update profile error', err);
        this.showToast('Lỗi kết nối máy chủ!', 'warning');
      }
    },

    handleChangePassword: async function (e) {
      e.preventDefault();
      const old_password = document.getElementById('oldPassword')?.value;
      const new_password = document.getElementById('newPassword')?.value;
      const confirm_password = document.getElementById('confirmPassword')?.value;

      if (!old_password || !new_password) {
        this.showToast('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới!', 'warning');
        return;
      }

      if (new_password.length < 6) {
        this.showToast('Mật khẩu mới phải có ít nhất 6 ký tự!', 'warning');
        return;
      }

      if (new_password !== confirm_password) {
        this.showToast('Mật khẩu xác nhận không khớp!', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_password, new_password })
        });
        const data = await res.json();

        if (data.success) {
          this.showToast(data.message || 'Đổi mật khẩu thành công!', 'success');
          this.closeProfileModal();
          // Reset password inputs
          const op = document.getElementById('oldPassword');
          const np = document.getElementById('newPassword');
          const cp = document.getElementById('confirmPassword');
          if (op) op.value = '';
          if (np) np.value = '';
          if (cp) cp.value = '';
        } else {
          this.showToast(data.message || 'Đổi mật khẩu thất bại!', 'warning');
        }
      } catch (err) {
        console.error('Change password error', err);
        this.showToast('Lỗi kết nối máy chủ!', 'warning');
      }
    },

    // ==========================================
    // HERO SHOWCASE SECTION
    // ==========================================
    initHero: function () {
      this.setHeroSlide(0);
      state.heroTimer = setInterval(() => {
        const next = (state.heroSlideIndex + 1) % state.heroSlides.length;
        this.setHeroSlide(next);
      }, 5000);
    },

    setHeroSlide: function (index) {
      state.heroSlideIndex = index;
      const slide = state.heroSlides[index];
      if (!slide) return;

      const imgEl = document.getElementById('heroImage');
      const catEl = document.getElementById('heroCategory');
      const titleEl = document.getElementById('heroTitle');
      const descEl = document.getElementById('heroDesc');
      const priceEl = document.getElementById('heroPrice');
      const orderBtn = document.getElementById('heroOrderBtn');

      if (imgEl) {
        imgEl.style.opacity = '0';
        setTimeout(() => {
          imgEl.src = slide.image;
          imgEl.alt = slide.title;
          imgEl.style.opacity = '1';
        }, 150);
      }

      if (catEl) catEl.textContent = slide.category;
      if (titleEl) titleEl.textContent = slide.title;
      if (descEl) descEl.textContent = slide.desc;
      if (priceEl) priceEl.textContent = formatVND(slide.price);
      if (orderBtn) {
        orderBtn.onclick = () => this.openCustomizeModalById(slide.id);
      }

      const dots = document.querySelectorAll('.hero-dot');
      dots.forEach((dot, i) => {
        if (i === index) {
          dot.className = 'hero-dot w-6 h-2 rounded-full bg-hl-gold transition-all';
        } else {
          dot.className = 'hero-dot w-2 h-2 rounded-full bg-white/40 hover:bg-white transition-all';
        }
      });
    },

    // ==========================================
    // CATEGORIES RENDERING & NAVIGATION
    // ==========================================
    renderCategories: function () {
      const container = document.getElementById('categoryTabsContainer');
      if (!container) return;

      const totalCount = state.products.length;

      const getIcon = (catId) => {
        switch (catId) {
          case 1: return '<i data-lucide="coffee" class="w-4 h-4"></i>';
          case 2: return '<i data-lucide="glass-water" class="w-4 h-4"></i>';
          case 3: return '<i data-lucide="leaf" class="w-4 h-4"></i>';
          case 4: return '<i data-lucide="cake" class="w-4 h-4"></i>';
          default: return '<i data-lucide="sparkles" class="w-4 h-4"></i>';
        }
      };

      let html = `
        <button 
          onclick="app.filterByCategory(0)" 
          class="cat-tab shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all shadow-sm ${state.currentCategory === 0 && !state.currentTag ? 'bg-hl-red text-white shadow-md' : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'}"
        >
          <i data-lucide="layout-grid" class="w-4 h-4"></i>
          <span>Tất cả</span>
          <span class="text-[11px] px-1.5 py-0.2 rounded-full ${state.currentCategory === 0 && !state.currentTag ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}">${totalCount}</span>
        </button>
      `;

      state.categories.forEach(cat => {
        const count = state.products.filter(p => p.categoryId === cat.id).length;
        const isActive = state.currentCategory === cat.id && !state.currentTag;
        html += `
          <button 
            onclick="app.filterByCategory(${cat.id})" 
            class="cat-tab shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all shadow-sm ${isActive ? 'bg-hl-red text-white shadow-md' : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'}"
          >
            ${getIcon(cat.id)}
            <span>${cat.name}</span>
            <span class="text-[11px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}">${count}</span>
          </button>
        `;
      });

      const phindiCount = state.products.filter(p => p.isPhindi).length;
      const isPhindiActive = state.currentTag === 'PhinDi';
      html += `
        <button 
          onclick="app.filterByTag('PhinDi')" 
          class="cat-tab shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all shadow-sm ${isPhindiActive ? 'bg-hl-brown text-white shadow-md' : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'}"
        >
          <i data-lucide="zap" class="w-4 h-4 text-hl-gold"></i>
          <span>PhinDi Mới</span>
          <span class="text-[11px] px-1.5 py-0.2 rounded-full ${isPhindiActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}">${phindiCount}</span>
        </button>
      `;

      const bestSellerCount = state.products.filter(p => p.isBestSeller).length;
      const isBestSellerActive = state.currentTag === 'Best Seller';
      html += `
        <button 
          onclick="app.filterByTag('Best Seller')" 
          class="cat-tab shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all shadow-sm ${isBestSellerActive ? 'bg-amber-600 text-white shadow-md' : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'}"
        >
          <i data-lucide="flame" class="w-4 h-4 text-yellow-300"></i>
          <span>Bán Chạy Nhất</span>
          <span class="text-[11px] px-1.5 py-0.2 rounded-full ${isBestSellerActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}">${bestSellerCount}</span>
        </button>
      `;

      container.innerHTML = html;
      if (window.lucide) lucide.createIcons();
      this.updateCategoryDescBanner();
    },

    updateCategoryDescBanner: function () {
      const banner = document.getElementById('categoryDescBanner');
      const title = document.getElementById('bannerCatTitle');
      const desc = document.getElementById('bannerCatDesc');
      if (!banner || !title || !desc) return;

      if (state.currentCategory > 0 && !state.currentTag) {
        const cat = state.categories.find(c => c.id === state.currentCategory);
        if (cat && cat.description) {
          title.textContent = cat.name + ' - Highlands Coffee';
          desc.textContent = cat.description;
          banner.classList.remove('hidden');
          return;
        }
      }
      banner.classList.add('hidden');
    },

    filterByCategory: function (catId) {
      state.currentCategory = catId;
      state.currentTag = null;
      this.renderCategories();
      this.renderProducts();
    },

    filterByTag: function (tag) {
      state.currentTag = tag;
      state.currentCategory = 0;
      this.renderCategories();
      this.renderProducts();
    },

    handleSearch: function (val) {
      state.searchQuery = val.trim();
      const clearBtn = document.getElementById('clearSearchBtn');
      if (clearBtn) {
        if (state.searchQuery.length > 0) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
      }
      this.renderProducts();
    },

    clearSearch: function () {
      state.searchQuery = '';
      const input = document.getElementById('searchInput');
      if (input) input.value = '';
      const clearBtn = document.getElementById('clearSearchBtn');
      if (clearBtn) clearBtn.classList.add('hidden');
      this.renderProducts();
    },

    handleSort: function (sortVal) {
      state.currentSort = sortVal;
      this.renderProducts();
    },

    resetAllFilters: function () {
      state.currentCategory = 0;
      state.currentTag = null;
      state.searchQuery = '';
      state.currentSort = 'default';

      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
      const clearBtn = document.getElementById('clearSearchBtn');
      if (clearBtn) clearBtn.classList.add('hidden');

      const sortSelect = document.getElementById('sortSelect');
      if (sortSelect) sortSelect.value = 'default';

      this.renderCategories();
      this.renderProducts();
    },

    // ==========================================
    // PRODUCTS FILTERING & RENDERING
    // ==========================================
    getFilteredProducts: function () {
      let list = [...state.products];

      if (state.currentCategory > 0) {
        list = list.filter(p => p.categoryId === state.currentCategory);
      }

      if (state.currentTag === 'Best Seller') {
        list = list.filter(p => p.isBestSeller);
      } else if (state.currentTag === 'PhinDi') {
        list = list.filter(p => p.isPhindi);
      } else if (state.currentTag === 'Món Mới') {
        list = list.filter(p => p.isNew);
      }

      if (state.searchQuery.length > 0) {
        const queryNorm = removeVietnameseTones(state.searchQuery);
        list = list.filter(p => {
          const nameNorm = removeVietnameseTones(p.name);
          const descNorm = removeVietnameseTones(p.description);
          const catNorm = removeVietnameseTones(p.categoryName);
          return nameNorm.includes(queryNorm) || descNorm.includes(queryNorm) || catNorm.includes(queryNorm);
        });
      }

      if (state.currentSort === 'price-asc') {
        list.sort((a, b) => a.price - b.price);
      } else if (state.currentSort === 'price-desc') {
        list.sort((a, b) => b.price - a.price);
      } else if (state.currentSort === 'name-asc') {
        list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      }

      return list;
    },

    renderProducts: function () {
      const container = document.getElementById('productGrid');
      const emptyState = document.getElementById('emptyState');
      const countBadge = document.getElementById('productTotalCountBadge');
      if (!container) return;

      const items = this.getFilteredProducts();

      if (countBadge) {
        countBadge.textContent = `${items.length} món`;
      }

      this.renderActiveFilters();

      if (items.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }

      if (emptyState) emptyState.classList.add('hidden');

      const placeholder = window.HIGHLANDS_DATA.defaultPlaceholder;

      const html = items.map(product => {
        let badgeHtml = '';
        if (product.isBestSeller) {
          badgeHtml = `
            <span class="absolute top-3 left-3 bg-gradient-to-r from-red-600 to-amber-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 z-10">
              <i data-lucide="flame" class="w-3 h-3 fill-current text-yellow-300"></i> Best Seller
            </span>
          `;
        } else if (product.isPhindi) {
          badgeHtml = `
            <span class="absolute top-3 left-3 bg-hl-brown text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 z-10 border border-hl-gold/40">
              <i data-lucide="zap" class="w-3 h-3 text-hl-gold"></i> PhinDi
            </span>
          `;
        } else if (product.isNew) {
          badgeHtml = `
            <span class="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 z-10">
              <i data-lucide="sparkles" class="w-3 h-3"></i> Mới
            </span>
          `;
        }

        return `
          <div 
            class="product-card group bg-white rounded-3xl p-3.5 sm:p-4 border border-stone-200/90 shadow-sm flex flex-col justify-between cursor-pointer relative overflow-hidden"
            onclick="app.openCustomizeModalById(${product.id})"
          >
            ${badgeHtml}

            <!-- Product Image -->
            <div class="product-img-wrapper relative w-full pt-[90%] rounded-2xl overflow-hidden bg-stone-50 flex items-center justify-center mb-3 border border-stone-100">
              <img 
                src="${product.image}" 
                alt="${product.name}" 
                onerror="this.onerror=null; this.src='${placeholder}';"
                class="absolute inset-0 w-full h-full object-contain p-2"
                loading="lazy"
              >
            </div>

            <!-- Product Details -->
            <div class="space-y-1.5 flex-1 flex flex-col justify-between">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-stone-400 font-sans">
                  ${product.categoryName}
                </span>
                <h3 class="font-display font-bold text-stone-900 text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-hl-red transition-colors">
                  ${product.name}
                </h3>
                <p class="text-[11px] text-stone-500 line-clamp-2 mt-1 hidden sm:block">
                  ${product.description || 'Thức uống thơm ngon đậm vị chuẩn phong cách Highlands Coffee.'}
                </p>
              </div>

              <!-- Price & CTA Button -->
              <div class="pt-3 flex items-center justify-between border-t border-stone-100/80 gap-2">
                <div>
                  <span class="text-[10px] text-stone-400 block font-medium leading-none">Giá từ</span>
                  <span class="text-sm sm:text-base font-extrabold text-hl-red font-mono">
                    ${formatVND(product.price)}
                  </span>
                </div>

                <button 
                  type="button"
                  onclick="event.stopPropagation(); app.openCustomizeModalById(${product.id})"
                  class="bg-hl-red group-hover:bg-hl-red-dark text-white rounded-xl p-2 sm:px-3 sm:py-2 text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1 active:scale-95 shrink-0"
                  title="Tùy chọn và mua"
                >
                  <i data-lucide="plus" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-hl-gold"></i>
                  <span class="hidden sm:inline">Chọn mua</span>
                </button>
              </div>
            </div>

          </div>
        `;
      }).join('');

      container.innerHTML = html;
      if (window.lucide) lucide.createIcons();
    },

    renderActiveFilters: function () {
      const container = document.getElementById('activeFiltersContainer');
      const pillsContainer = document.getElementById('filterPills');
      if (!container || !pillsContainer) return;

      const hasFilters = (state.currentCategory > 0) || state.currentTag || (state.searchQuery.length > 0) || (state.currentSort !== 'default');

      if (!hasFilters) {
        container.classList.add('hidden');
        pillsContainer.innerHTML = '';
        return;
      }

      container.classList.remove('hidden');
      let html = '';

      if (state.currentCategory > 0) {
        const cat = state.categories.find(c => c.id === state.currentCategory);
        if (cat) {
          html += `
            <span class="inline-flex items-center gap-1 bg-red-100 text-hl-red text-xs px-2.5 py-1 rounded-full font-medium">
              ${cat.name}
              <button onclick="app.filterByCategory(0)" class="hover:text-red-900"><i data-lucide="x" class="w-3 h-3"></i></button>
            </span>
          `;
        }
      }

      if (state.currentTag) {
        html += `
          <span class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-medium">
            Tag: ${state.currentTag}
            <button onclick="app.filterByTag(null)" class="hover:text-amber-950"><i data-lucide="x" class="w-3 h-3"></i></button>
          </span>
        `;
      }

      if (state.searchQuery) {
        html += `
          <span class="inline-flex items-center gap-1 bg-stone-200 text-stone-800 text-xs px-2.5 py-1 rounded-full font-medium">
            Từ khóa: "${state.searchQuery}"
            <button onclick="app.clearSearch()" class="hover:text-black"><i data-lucide="x" class="w-3 h-3"></i></button>
          </span>
        `;
      }

      pillsContainer.innerHTML = html;
      if (window.lucide) lucide.createIcons();
    },

    // ==========================================
    // DRINK CUSTOMIZATION MODAL
    // ==========================================
    openCustomizeModalById: function (productId) {
      const product = state.products.find(p => p.id === productId);
      if (!product) return;

      state.customizingProduct = product;
      
      state.modalForm = {
        size: product.sizes[0] || { code: 'STANDARD', name: 'Tiêu chuẩn', extra: 0 },
        sugar: '100%',
        ice: '100%',
        toppings: [],
        notes: '',
        quantity: 1
      };

      const modal = document.getElementById('customizeModal');
      const nameEl = document.getElementById('modalDrinkName');
      const titlePrev = document.getElementById('modalDrinkTitlePreview');
      const imgEl = document.getElementById('modalDrinkImg');
      const catEl = document.getElementById('modalDrinkCategory');
      const descEl = document.getElementById('modalDrinkDesc');
      const basePriceEl = document.getElementById('modalDrinkBasePrice');
      const notesEl = document.getElementById('modalDrinkNotes');
      const qtyEl = document.getElementById('modalQuantity');

      if (nameEl) nameEl.textContent = product.name;
      if (titlePrev) titlePrev.textContent = product.name;
      if (imgEl) {
        imgEl.src = product.image;
        imgEl.onerror = () => { imgEl.src = window.HIGHLANDS_DATA.defaultPlaceholder; };
      }
      if (catEl) catEl.textContent = product.categoryName;
      if (descEl) descEl.textContent = product.description || 'Hương vị thơm ngon truyền thống Highlands Coffee.';
      if (basePriceEl) basePriceEl.textContent = formatVND(product.price);
      if (notesEl) notesEl.value = '';
      if (qtyEl) qtyEl.textContent = '1';

      const sizeSec = document.getElementById('sizeSection');
      const sugarSec = document.getElementById('sugarSection');
      const iceSec = document.getElementById('iceSection');
      const toppingSec = document.getElementById('toppingSection');

      if (product.isCake) {
        if (sizeSec) sizeSec.classList.add('hidden');
        if (sugarSec) sugarSec.classList.add('hidden');
        if (iceSec) iceSec.classList.add('hidden');
        if (toppingSec) toppingSec.classList.add('hidden');
      } else {
        if (sizeSec) sizeSec.classList.remove('hidden');
        if (sugarSec) sugarSec.classList.remove('hidden');
        if (iceSec) iceSec.classList.remove('hidden');
        if (toppingSec) toppingSec.classList.remove('hidden');
        
        this.renderModalSizes(product);
        this.renderModalSugar();
        this.renderModalIce();
        this.renderModalToppings();
      }

      this.updateModalTotalPrice();

      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
      }, 10);

      if (window.lucide) lucide.createIcons();
    },

    closeCustomizeModal: function () {
      const modal = document.getElementById('customizeModal');
      if (!modal) return;
      modal.classList.add('opacity-0');
      setTimeout(() => {
        modal.classList.add('hidden');
        state.customizingProduct = null;
      }, 200);
    },

    renderModalSizes: function (product) {
      const container = document.getElementById('sizeOptionsContainer');
      if (!container) return;

      const html = product.sizes.map((size, idx) => {
        const isChecked = idx === 0;
        return `
          <div>
            <input 
              type="radio" 
              name="modalSize" 
              id="size_${size.code}" 
              value="${size.code}"
              ${isChecked ? 'checked' : ''}
              class="hidden peer"
              onchange="app.handleSizeChange('${size.code}')"
            >
            <label 
              for="size_${size.code}" 
              class="flex flex-col items-center justify-center p-2.5 rounded-2xl border-2 border-stone-200 peer-checked:border-hl-red peer-checked:bg-red-50 text-stone-700 peer-checked:text-hl-red font-medium cursor-pointer transition-all text-center"
            >
              <span class="font-bold text-xs">${size.name}</span>
              <span class="text-[11px] text-stone-500 peer-checked:text-hl-red mt-0.5 font-mono">
                ${size.extra === 0 ? '+0đ' : '+' + formatVND(size.extra)}
              </span>
            </label>
          </div>
        `;
      }).join('');

      container.innerHTML = html;
    },

    renderModalSugar: function () {
      const container = document.getElementById('sugarOptionsContainer');
      if (!container) return;

      const levels = [
        { val: '100%', label: '100% (Chuẩn)' },
        { val: '70%', label: '70%' },
        { val: '50%', label: '50%' },
        { val: '30%', label: '30%' },
        { val: '0%', label: '0% (Không đường)' }
      ];

      const html = levels.map((lvl, idx) => {
        const isChecked = idx === 0;
        return `
          <div>
            <input 
              type="radio" 
              name="modalSugar" 
              id="sugar_${lvl.val}" 
              value="${lvl.val}" 
              ${isChecked ? 'checked' : ''}
              class="hidden peer"
              onchange="app.handleSugarChange('${lvl.val}')"
            >
            <label 
              for="sugar_${lvl.val}" 
              class="block py-2 text-center text-xs font-semibold rounded-xl border border-stone-200 peer-checked:border-hl-gold peer-checked:bg-amber-50 text-stone-600 peer-checked:text-amber-900 cursor-pointer transition-all"
            >
              ${lvl.val}
            </label>
          </div>
        `;
      }).join('');

      container.innerHTML = html;
    },

    renderModalIce: function () {
      const container = document.getElementById('iceOptionsContainer');
      if (!container) return;

      const levels = [
        { val: '100%', label: '100% (Chuẩn)' },
        { val: '70%', label: '70%' },
        { val: '50%', label: '50%' },
        { val: 'Đá riêng', label: 'Đá riêng' },
        { val: 'Không đá', label: 'Không đá' }
      ];

      const html = levels.map((lvl, idx) => {
        const isChecked = idx === 0;
        return `
          <div>
            <input 
              type="radio" 
              name="modalIce" 
              id="ice_${lvl.val}" 
              value="${lvl.val}" 
              ${isChecked ? 'checked' : ''}
              class="hidden peer"
              onchange="app.handleIceChange('${lvl.val}')"
            >
            <label 
              for="ice_${lvl.val}" 
              class="block py-2 text-center text-xs font-semibold rounded-xl border border-stone-200 peer-checked:border-cyan-500 peer-checked:bg-cyan-50 text-stone-600 peer-checked:text-cyan-900 cursor-pointer transition-all"
            >
              ${lvl.val}
            </label>
          </div>
        `;
      }).join('');

      container.innerHTML = html;
    },

    renderModalToppings: function () {
      const container = document.getElementById('toppingsContainer');
      if (!container) return;

      const html = state.toppings.map(t => {
        return `
          <label class="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 hover:border-stone-300 bg-stone-50/50 cursor-pointer transition-all has-[:checked]:border-hl-red has-[:checked]:bg-red-50/40">
            <div class="flex items-center gap-2">
              <input 
                type="checkbox" 
                value="${t.id}" 
                class="w-4 h-4 text-hl-red rounded focus:ring-hl-red border-stone-300"
                onchange="app.handleToppingToggle('${t.id}', this.checked)"
              >
              <span class="text-xs font-semibold text-stone-800">${t.name}</span>
            </div>
            <span class="text-xs font-mono font-bold text-hl-red">+${formatVND(t.price)}</span>
          </label>
        `;
      }).join('');

      container.innerHTML = html;
    },

    handleSizeChange: function (code) {
      if (!state.customizingProduct) return;
      const sizeObj = state.customizingProduct.sizes.find(s => s.code === code);
      if (sizeObj) {
        state.modalForm.size = sizeObj;
        this.updateModalTotalPrice();
      }
    },

    handleSugarChange: function (val) {
      state.modalForm.sugar = val;
    },

    handleIceChange: function (val) {
      state.modalForm.ice = val;
    },

    handleToppingToggle: function (toppingId, isChecked) {
      const topping = state.toppings.find(t => t.id === toppingId);
      if (!topping) return;

      if (isChecked) {
        state.modalForm.toppings.push(topping);
      } else {
        state.modalForm.toppings = state.modalForm.toppings.filter(t => t.id !== toppingId);
      }
      this.updateModalTotalPrice();
    },

    changeModalQty: function (delta) {
      const newQty = state.modalForm.quantity + delta;
      if (newQty >= 1 && newQty <= 99) {
        state.modalForm.quantity = newQty;
        const qtyEl = document.getElementById('modalQuantity');
        if (qtyEl) qtyEl.textContent = newQty;
        this.updateModalTotalPrice();
      }
    },

    calculateModalItemPrice: function () {
      if (!state.customizingProduct) return 0;
      let unit = state.customizingProduct.price;

      if (state.modalForm.size && state.modalForm.size.extra) {
        unit += state.modalForm.size.extra;
      }

      if (state.modalForm.toppings && state.modalForm.toppings.length > 0) {
        const topTotal = state.modalForm.toppings.reduce((acc, cur) => acc + cur.price, 0);
        unit += topTotal;
      }

      return unit;
    },

    updateModalTotalPrice: function () {
      const unit = this.calculateModalItemPrice();
      const total = unit * state.modalForm.quantity;
      const totalEl = document.getElementById('modalTotalPrice');
      if (totalEl) {
        totalEl.textContent = formatVND(total);
      }
    },

    confirmAddToCart: function () {
      if (!state.customizingProduct) return;

      const p = state.customizingProduct;
      const notesEl = document.getElementById('modalDrinkNotes');
      const notes = notesEl ? notesEl.value.trim() : '';
      const unitPrice = this.calculateModalItemPrice();
      const qty = state.modalForm.quantity;

      const cartItem = {
        uid: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        productId: p.id,
        name: p.name,
        image: p.image,
        categoryName: p.categoryName,
        isCake: p.isCake,
        size: state.modalForm.size,
        sugar: state.modalForm.sugar,
        ice: state.modalForm.ice,
        toppings: [...state.modalForm.toppings],
        notes: notes,
        unitPrice: unitPrice,
        quantity: qty,
        totalPrice: unitPrice * qty
      };

      const existingIndex = state.cart.findIndex(item => {
        if (item.productId !== cartItem.productId) return false;
        if (item.size?.code !== cartItem.size?.code) return false;
        if (item.sugar !== cartItem.sugar) return false;
        if (item.ice !== cartItem.ice) return false;
        if (item.notes !== cartItem.notes) return false;
        const topIds1 = (item.toppings || []).map(t => t.id).sort().join(',');
        const topIds2 = (cartItem.toppings || []).map(t => t.id).sort().join(',');
        return topIds1 === topIds2;
      });

      if (existingIndex > -1) {
        state.cart[existingIndex].quantity += cartItem.quantity;
        state.cart[existingIndex].totalPrice = state.cart[existingIndex].unitPrice * state.cart[existingIndex].quantity;
      } else {
        state.cart.unshift(cartItem);
      }

      this.saveCart();
      this.updateCartBadge(true);
      this.closeCustomizeModal();
      this.showToast(`Đã thêm ${qty}x ${p.name} vào giỏ hàng!`, 'success');
    },

    // ==========================================
    // SHOPPING CART DRAWER & OPERATIONS
    // ==========================================
    saveCart: function () {
      try {
        localStorage.setItem('hl_cart', JSON.stringify(state.cart));
      } catch (e) {
        console.warn('Could not save cart to localStorage', e);
      }
    },

    updateCartBadge: function (shouldBounce = false) {
      const badge = document.getElementById('cartBadge');
      const headerTotal = document.getElementById('cartHeaderTotal');
      const totalCount = state.cart.reduce((acc, item) => acc + item.quantity, 0);
      const subtotal = state.cart.reduce((acc, item) => acc + item.totalPrice, 0);

      if (badge) {
        badge.textContent = totalCount;
        if (shouldBounce) {
          badge.classList.remove('cart-badge-bounce');
          void badge.offsetWidth;
          badge.classList.add('cart-badge-bounce');
        }
      }

      if (headerTotal) {
        headerTotal.textContent = formatVND(subtotal);
      }
    },

    toggleCart: function (isOpen) {
      const backdrop = document.getElementById('cartDrawerBackdrop');
      const content = document.getElementById('cartDrawerContent');
      if (!backdrop || !content) return;

      if (isOpen) {
        this.renderCart();
        backdrop.classList.remove('hidden');
        setTimeout(() => {
          backdrop.classList.remove('opacity-0');
          content.classList.remove('translate-x-full');
        }, 10);
      } else {
        backdrop.classList.add('opacity-0');
        content.classList.add('translate-x-full');
        setTimeout(() => {
          backdrop.classList.add('hidden');
        }, 300);
      }
    },

    renderCart: function () {
      const listContainer = document.getElementById('cartItemsList');
      const emptyState = document.getElementById('cartEmptyState');
      const footer = document.getElementById('cartFooterSection');
      const subCount = document.getElementById('cartDrawerSubCount');
      if (!listContainer) return;

      const totalQty = state.cart.reduce((acc, item) => acc + item.quantity, 0);
      if (subCount) subCount.textContent = `${totalQty} món trong giỏ`;

      if (state.cart.length === 0) {
        listContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        if (footer) footer.classList.add('hidden');
        this.updateFreeShipProgress(0);
        return;
      }

      listContainer.classList.remove('hidden');
      if (emptyState) emptyState.classList.add('hidden');
      if (footer) footer.classList.remove('hidden');

      const placeholder = window.HIGHLANDS_DATA.defaultPlaceholder;

      const html = state.cart.map(item => {
        const chips = [];
        if (!item.isCake && item.size) chips.push(item.size.name);
        if (!item.isCake && item.sugar) chips.push('Đường: ' + item.sugar);
        if (!item.isCake && item.ice) chips.push('Đá: ' + item.ice);
        if (item.toppings && item.toppings.length > 0) {
          chips.push(...item.toppings.map(t => '+ ' + t.name));
        }

        const chipsHtml = chips.map(c => `
          <span class="bg-stone-100 text-stone-600 text-[10px] px-1.5 py-0.5 rounded border border-stone-200">
            ${c}
          </span>
        `).join('');

        const notesHtml = item.notes ? `
          <div class="text-[10px] text-amber-700 italic flex items-center gap-1 mt-1">
            <i data-lucide="message-square" class="w-3 h-3"></i> "${item.notes}"
          </div>
        ` : '';

        return `
          <div class="pt-3 pb-2 flex gap-3 items-start">
            <img 
              src="${item.image}" 
              alt="${item.name}" 
              onerror="this.onerror=null; this.src='${placeholder}';"
              class="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-200 p-1 shrink-0"
            >
            <div class="flex-1 min-w-0 space-y-1">
              <div class="flex items-start justify-between gap-2">
                <h4 class="font-bold text-stone-800 text-xs sm:text-sm leading-tight">${item.name}</h4>
                <button 
                  onclick="app.removeCartItem('${item.uid}')" 
                  class="text-stone-400 hover:text-hl-red transition-colors p-0.5"
                  title="Xóa món"
                >
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>

              <div class="flex flex-wrap gap-1">
                ${chipsHtml}
              </div>

              ${notesHtml}

              <div class="flex items-center justify-between pt-1">
                <div class="flex items-center border border-stone-200 rounded-lg bg-stone-50">
                  <button 
                    onclick="app.changeCartQty('${item.uid}', -1)" 
                    class="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-200 rounded-l active:scale-95 text-xs font-bold"
                  >-</button>
                  <span class="w-6 text-center text-xs font-bold font-mono">${item.quantity}</span>
                  <button 
                    onclick="app.changeCartQty('${item.uid}', 1)" 
                    class="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-200 rounded-r active:scale-95 text-xs font-bold"
                  >+</button>
                </div>

                <div class="font-bold text-hl-red font-mono text-xs sm:text-sm">
                  ${formatVND(item.totalPrice)}
                </div>
              </div>

            </div>
          </div>
        `;
      }).join('');

      listContainer.innerHTML = html;
      this.updateCartCalculations();
      if (window.lucide) lucide.createIcons();
    },

    changeCartQty: function (uid, delta) {
      const item = state.cart.find(i => i.uid === uid);
      if (!item) return;

      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        this.removeCartItem(uid);
      } else {
        item.quantity = newQty;
        item.totalPrice = item.unitPrice * newQty;
        this.saveCart();
        this.renderCart();
        this.updateCartBadge();
      }
    },

    removeCartItem: function (uid) {
      state.cart = state.cart.filter(i => i.uid !== uid);
      this.saveCart();
      this.renderCart();
      this.updateCartBadge();
      this.showToast('Đã xóa món khỏi giỏ hàng', 'info');
    },

    updateFreeShipProgress: function (subtotal) {
      const freeShipThreshold = 150000;
      const textEl = document.getElementById('freeShipText');
      const percentEl = document.getElementById('freeShipPercentText');
      const barEl = document.getElementById('freeShipProgressBar');

      if (!textEl || !percentEl || !barEl) return;

      if (subtotal >= freeShipThreshold) {
        textEl.textContent = '🎉 Bạn đã được MIỄN PHÍ VẬN CHUYỂN!';
        percentEl.textContent = '100%';
        barEl.style.width = '100%';
      } else {
        const remaining = freeShipThreshold - subtotal;
        const pct = Math.min(100, Math.round((subtotal / freeShipThreshold) * 100));
        textEl.textContent = `Mua thêm ${formatVND(remaining)} để được FREESHIP`;
        percentEl.textContent = `${pct}%`;
        barEl.style.width = `${pct}%`;
      }
    },

    updateCartCalculations: function () {
      const subtotal = state.cart.reduce((acc, item) => acc + item.totalPrice, 0);
      let shipping = 15000;
      let discount = 0;

      if (subtotal >= 150000) {
        shipping = 0;
      }

      if (state.voucher) {
        if (state.voucher.code === 'HIGHLANDS20') {
          discount = Math.min(20000, subtotal);
        } else if (state.voucher.code === 'FREESHIP') {
          shipping = 0;
        } else if (state.voucher.code === 'HL10') {
          discount = Math.round(subtotal * 0.1);
        }
      }

      const grandTotal = Math.max(0, subtotal - discount + shipping);

      const subEl = document.getElementById('cartSubtotal');
      const shipEl = document.getElementById('cartShipping');
      const discEl = document.getElementById('cartDiscount');
      const totalEl = document.getElementById('cartGrandTotal');

      if (subEl) subEl.textContent = formatVND(subtotal);
      if (shipEl) shipEl.textContent = shipping === 0 ? 'Miễn phí' : formatVND(shipping);
      if (discEl) discEl.textContent = '-' + formatVND(discount);
      if (totalEl) totalEl.textContent = formatVND(grandTotal);

      this.updateFreeShipProgress(subtotal);
    },

    applyVoucher: function () {
      const input = document.getElementById('voucherInput');
      const msg = document.getElementById('voucherMessage');
      if (!input || !msg) return;

      const code = input.value.trim().toUpperCase();
      if (!code) return;

      const subtotal = state.cart.reduce((acc, item) => acc + item.totalPrice, 0);

      if (code === 'HIGHLANDS20') {
        if (subtotal < 60000) {
          msg.textContent = 'Mã HIGHLANDS20 áp dụng cho đơn từ 60.000đ trở lên.';
          msg.className = 'text-[11px] font-semibold text-red-600 block';
          return;
        }
        state.voucher = { code: 'HIGHLANDS20', discount: 20000 };
        msg.textContent = '✓ Áp dụng mã HIGHLANDS20 thành công: Giảm 20.000đ';
        msg.className = 'text-[11px] font-semibold text-emerald-600 block';
      } else if (code === 'FREESHIP') {
        state.voucher = { code: 'FREESHIP', freeShipping: true };
        msg.textContent = '✓ Áp dụng mã FREESHIP thành công: Miễn phí vận chuyển!';
        msg.className = 'text-[11px] font-semibold text-emerald-600 block';
      } else if (code === 'HL10') {
        state.voucher = { code: 'HL10', discountPercent: 10 };
        msg.textContent = '✓ Áp dụng mã HL10 thành công: Giảm 10% đơn hàng!';
        msg.className = 'text-[11px] font-semibold text-emerald-600 block';
      } else {
        msg.textContent = 'Mã giảm giá không hợp lệ hoặc đã hết lượt dùng.';
        msg.className = 'text-[11px] font-semibold text-red-600 block';
        return;
      }

      this.updateCartCalculations();
      this.showToast('Đã áp dụng mã giảm giá ' + code, 'success');
    },

    // ==========================================
    // CHECKOUT MODAL & ORDER SUBMISSION (SQLITE)
    // ==========================================
    openCheckoutModal: function () {
      if (state.cart.length === 0) {
        this.showToast('Giỏ hàng của bạn đang trống!', 'warning');
        return;
      }

      this.toggleCart(false);

      const modal = document.getElementById('checkoutModal');
      const countEl = document.getElementById('checkoutItemCount');
      const totalEl = document.getElementById('checkoutTotalAmount');

      const nameInput = document.getElementById('custName');
      const phoneInput = document.getElementById('custPhone');
      const addrInput = document.getElementById('custAddress');

      // Auto prefill if member is logged in
      if (state.currentUser) {
        if (nameInput && !nameInput.value) nameInput.value = state.currentUser.full_name || '';
        if (phoneInput && !phoneInput.value) phoneInput.value = state.currentUser.phone || '';
        if (addrInput && !addrInput.value) addrInput.value = state.currentUser.address || '';
      }

      const totalQty = state.cart.reduce((acc, item) => acc + item.quantity, 0);
      const subtotal = state.cart.reduce((acc, item) => acc + item.totalPrice, 0);
      let shipping = subtotal >= 150000 ? 0 : 15000;
      let discount = 0;
      if (state.voucher?.code === 'HIGHLANDS20') discount = 20000;
      if (state.voucher?.code === 'FREESHIP') shipping = 0;
      if (state.voucher?.code === 'HL10') discount = Math.round(subtotal * 0.1);
      const grandTotal = Math.max(0, subtotal - discount + shipping);

      if (countEl) countEl.textContent = `${totalQty} món`;
      if (totalEl) totalEl.textContent = formatVND(grandTotal);

      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
      }, 10);

      if (window.lucide) lucide.createIcons();
    },

    closeCheckoutModal: function () {
      const modal = document.getElementById('checkoutModal');
      if (!modal) return;
      modal.classList.add('opacity-0');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    },

    handleOrderTypeChange: function (type) {
      state.orderType = type;
      const addrSec = document.getElementById('addressSection');
      const branchSec = document.getElementById('branchSection');
      const addrInput = document.getElementById('custAddress');

      if (type === 'delivery') {
        if (addrSec) addrSec.classList.remove('hidden');
        if (branchSec) branchSec.classList.add('hidden');
        if (addrInput) addrInput.required = true;
      } else {
        if (addrSec) addrSec.classList.add('hidden');
        if (branchSec) branchSec.classList.remove('hidden');
        if (addrInput) addrInput.required = false;
      }
    },

    submitOrder: async function (e) {
      e.preventDefault();

      const name = document.getElementById('custName')?.value.trim();
      const phone = document.getElementById('custPhone')?.value.trim();
      const note = document.getElementById('checkoutNote')?.value.trim();
      const payment = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD';

      if (!name || !phone) {
        this.showToast('Vui lòng điền đầy đủ họ tên và số điện thoại!', 'warning');
        return;
      }

      const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
      if (!phoneRegex.test(phone)) {
        this.showToast('Số điện thoại không hợp lệ, vui lòng kiểm tra lại!', 'warning');
        return;
      }

      let address = '';
      if (state.orderType === 'delivery') {
        address = document.getElementById('custAddress')?.value.trim();
        if (!address) {
          this.showToast('Vui lòng nhập địa chỉ giao hàng cụ thể!', 'warning');
          return;
        }
      } else {
        address = document.getElementById('custBranch')?.value || 'Highlands Coffee gần nhất';
      }

      const subtotal = state.cart.reduce((acc, item) => acc + item.totalPrice, 0);
      let shipping = (state.orderType === 'takeaway' || subtotal >= 150000) ? 0 : 15000;
      let discount = 0;
      if (state.voucher?.code === 'HIGHLANDS20') discount = 20000;
      if (state.voucher?.code === 'FREESHIP') shipping = 0;
      if (state.voucher?.code === 'HL10') discount = Math.round(subtotal * 0.1);
      const grandTotal = Math.max(0, subtotal - discount + shipping);

      const orderPayload = {
        order_type: state.orderType,
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        customer_note: note,
        payment_method: payment,
        items: [...state.cart],
        subtotal: subtotal,
        discount: discount,
        shipping_fee: shipping,
        total_amount: grandTotal
      };

      try {
        // Send order to Python Flask backend & SQLite DB
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload)
        });
        const data = await res.json();

        if (data.success && data.order) {
          const createdOrder = data.order;
          
          // Format for receipt display
          const receiptOrder = {
            code: createdOrder.order_code,
            timeFormatted: new Date(createdOrder.created_at || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('vi-VN'),
            orderType: createdOrder.order_type,
            customer: {
              name: createdOrder.customer_name,
              phone: createdOrder.customer_phone,
              address: createdOrder.customer_address
            },
            paymentMethod: createdOrder.payment_method,
            items: [...state.cart],
            subtotal: createdOrder.subtotal,
            discount: createdOrder.discount,
            shipping: createdOrder.shipping_fee,
            total: createdOrder.total_amount
          };

          // Also backup to localStorage
          try {
            const history = JSON.parse(localStorage.getItem('hl_order_history') || '[]');
            history.unshift(receiptOrder);
            localStorage.setItem('hl_order_history', JSON.stringify(history));
          } catch (e) {}

          // Clear cart
          state.cart = [];
          state.voucher = null;
          this.saveCart();
          this.updateCartBadge();

          this.closeCheckoutModal();
          this.showReceiptModal(receiptOrder);
          this.showToast('Đặt hàng thành công! Mã đơn: ' + createdOrder.order_code, 'success');
        } else {
          this.showToast(data.message || 'Không thể tạo đơn hàng!', 'warning');
        }
      } catch (err) {
        console.error('Order submission error', err);
        this.showToast('Lỗi khi gửi đơn hàng đến máy chủ!', 'warning');
      }
    },

    // ==========================================
    // RECEIPT & ORDER SUCCESS MODAL
    // ==========================================
    showReceiptModal: function (order) {
      const modal = document.getElementById('orderReceiptModal');
      if (!modal) return;

      const codeEl = document.getElementById('receiptOrderCode');
      const timeEl = document.getElementById('receiptOrderTime');
      const nameEl = document.getElementById('receiptCustName');
      const phoneEl = document.getElementById('receiptCustPhone');
      const addrEl = document.getElementById('receiptAddress');
      const payEl = document.getElementById('receiptPayment');
      const subEl = document.getElementById('receiptSubtotal');
      const discEl = document.getElementById('receiptDiscount');
      const shipEl = document.getElementById('receiptShipping');
      const totalEl = document.getElementById('receiptTotal');
      const itemsContainer = document.getElementById('receiptItemsContainer');
      const qrSection = document.getElementById('receiptQrSection');
      const qrImg = document.getElementById('receiptQrImg');

      if (codeEl) codeEl.textContent = order.code;
      if (timeEl) timeEl.textContent = order.timeFormatted;
      if (nameEl) nameEl.textContent = order.customer.name;
      if (phoneEl) phoneEl.textContent = order.customer.phone;
      if (addrEl) addrEl.textContent = (order.orderType === 'takeaway' ? '[Tại quán] ' : '[Giao tận nơi] ') + order.customer.address;
      
      const paymentLabels = {
        'COD': 'Tiền mặt khi nhận hàng (COD)',
        'VIETQR': 'Chuyển khoản VietQR',
        'MOMO': 'Ví MoMo'
      };
      if (payEl) payEl.textContent = paymentLabels[order.paymentMethod] || order.paymentMethod;

      if (subEl) subEl.textContent = formatVND(order.subtotal);
      if (discEl) discEl.textContent = '-' + formatVND(order.discount);
      if (shipEl) shipEl.textContent = order.shipping === 0 ? 'Miễn phí' : formatVND(order.shipping);
      if (totalEl) totalEl.textContent = formatVND(order.total);

      if (itemsContainer) {
        itemsContainer.innerHTML = order.items.map(it => {
          const detail = [];
          if (it.size) detail.push(it.size.name);
          if (it.sugar) detail.push('Đường ' + it.sugar);
          if (it.ice) detail.push('Đá ' + it.ice);
          if (it.toppings?.length) detail.push(...it.toppings.map(t => t.name));
          return `
            <div class="pt-2 flex justify-between items-start text-xs">
              <div class="space-y-0.5">
                <div class="font-bold text-stone-800">${it.quantity}x ${it.name}</div>
                <div class="text-[10px] text-stone-500">${detail.join(' • ')}</div>
              </div>
              <div class="font-mono font-bold text-stone-900">${formatVND(it.totalPrice)}</div>
            </div>
          `;
        }).join('');
      }

      if (order.paymentMethod === 'VIETQR' && qrSection && qrImg) {
        qrSection.classList.remove('hidden');
        const memo = encodeURIComponent(order.code);
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=2|99|0912345678|Highlands%20Coffee||0|0|${order.total}|${memo}|transfer_myqr`;
      } else if (qrSection) {
        qrSection.classList.add('hidden');
      }

      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
      }, 10);

      if (window.lucide) lucide.createIcons();
    },

    closeReceiptModal: function () {
      const modal = document.getElementById('orderReceiptModal');
      if (!modal) return;
      modal.classList.add('opacity-0');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    },

    // ==========================================
    // ORDER HISTORY MODAL (SQLITE + LOCALSTORAGE)
    // ==========================================
    openOrderHistory: async function () {
      const modal = document.getElementById('orderHistoryModal');
      const listContainer = document.getElementById('orderHistoryList');
      if (!modal || !listContainer) return;

      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
      }, 10);

      listContainer.innerHTML = `
        <div class="text-center py-8">
          <div class="w-8 h-8 border-2 border-hl-red border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p class="text-stone-500 text-xs">Đang tải lịch sử đơn hàng từ cơ sở dữ liệu...</p>
        </div>
      `;

      let orders = [];

      try {
        // Fetch orders from SQLite backend
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (data.success && data.orders && data.orders.length > 0) {
          orders = data.orders.map(o => ({
            code: o.order_code,
            timeFormatted: new Date(o.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date(o.created_at).toLocaleDateString('vi-VN'),
            orderType: o.order_type,
            customer: {
              name: o.customer_name,
              phone: o.customer_phone,
              address: o.customer_address
            },
            paymentMethod: o.payment_method,
            items: o.items || [],
            subtotal: o.subtotal,
            discount: o.discount,
            shipping: o.shipping_fee,
            total: o.total_amount,
            status: o.status
          }));
        }
      } catch (err) {
        console.warn('API order fetch error, falling back to localStorage', err);
      }

      // If no orders from API, check local fallback
      if (orders.length === 0) {
        try {
          orders = JSON.parse(localStorage.getItem('hl_order_history') || '[]');
        } catch (e) {}
      }

      if (orders.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center py-10">
            <div class="w-14 h-14 rounded-full bg-stone-100 mx-auto flex items-center justify-center text-stone-400 mb-2">
              <i data-lucide="receipt" class="w-7 h-7"></i>
            </div>
            <p class="font-bold text-stone-700">Chưa có đơn hàng nào</p>
            <p class="text-xs text-stone-500 mt-1">Các đơn hàng bạn đặt sẽ được lưu trữ an toàn trong cơ sở dữ liệu.</p>
          </div>
        `;
      } else {
        listContainer.innerHTML = orders.map((ord, idx) => `
          <div class="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
            <div class="flex items-center justify-between border-b border-stone-200/60 pb-2">
              <div>
                <span class="font-mono font-bold text-hl-red text-sm">${ord.code}</span>
                <span class="text-[11px] text-stone-400 block">${ord.timeFormatted}</span>
              </div>
              <span class="bg-amber-100 text-amber-900 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                ${ord.status || 'Đang chuẩn bị'}
              </span>
            </div>

            <div class="text-xs text-stone-600 space-y-1">
              <div><strong>Khách hàng:</strong> ${ord.customer?.name} (${ord.customer?.phone})</div>
              <div class="truncate"><strong>Địa chỉ:</strong> ${ord.customer?.address}</div>
              <div><strong>Số món:</strong> ${ord.items?.length || 0} món • <strong>Tổng:</strong> <span class="font-bold text-hl-red">${formatVND(ord.total)}</span></div>
            </div>

            <div class="pt-2 flex justify-end gap-2 border-t border-stone-200/60">
              <button 
                onclick="app.viewPastReceipt(${idx})" 
                class="px-3 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center gap-1"
              >
                <i data-lucide="eye" class="w-3.5 h-3.5"></i> Xem hóa đơn
              </button>
            </div>
          </div>
        `).join('');

        // Store active orders array for receipt viewing
        state.activeOrdersCache = orders;
      }

      if (window.lucide) lucide.createIcons();
    },

    viewPastReceipt: function (index) {
      const orders = state.activeOrdersCache || [];
      if (orders[index]) {
        this.closeOrderHistory();
        this.showReceiptModal(orders[index]);
      }
    },

    closeOrderHistory: function () {
      const modal = document.getElementById('orderHistoryModal');
      if (!modal) return;
      modal.classList.add('opacity-0');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    },

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    showToast: function (message, type = 'info') {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      
      let bgClass = 'bg-stone-900 text-white';
      let icon = '<i data-lucide="info" class="w-4 h-4 text-sky-400"></i>';

      if (type === 'success') {
        bgClass = 'bg-emerald-900/95 text-white border border-emerald-700';
        icon = '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>';
      } else if (type === 'warning') {
        bgClass = 'bg-amber-900/95 text-white border border-amber-700';
        icon = '<i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400"></i>';
      }

      toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-medium transition-all duration-300 pointer-events-auto transform translate-y-4 opacity-0 ${bgClass}`;
      toast.innerHTML = `
        ${icon}
        <span>${message}</span>
      `;

      container.appendChild(toast);
      if (window.lucide) lucide.createIcons();

      setTimeout(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
      }, 10);

      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-4');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }
  };

  // Start app when DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
  });

})();
