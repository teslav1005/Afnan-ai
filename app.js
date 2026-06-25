// General App Functions
function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}
window.addEventListener('resize', setAppHeight);
setAppHeight();

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        const header = document.querySelector('header');
        if (header) header.style.top = window.visualViewport.offsetTop + 'px';
    });
    window.visualViewport.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        if (header) header.style.top = window.visualViewport.offsetTop + 'px';
    });
}

// ============================================
// نظام إدارة الحسابات والاشتراكات
// ============================================

const AccountSystem = {
    // خطط الاشتراك
    plans: {
        free: { name: 'Free', price: 0, period: 'شهري' },
        pro: { name: 'Pro', price: 10, period: 'شهري', description: 'استخدام مفتوح بحدود' },
        ultra: { name: 'Ultra', price: 20, period: 'شهري', description: 'استخدام مفتوح بأعلى سقف' }
    },

    // الحصول على بيانات المستخدم الحالي
    getCurrentUser() {
        const user = localStorage.getItem('afnanUser');
        return user ? JSON.parse(user) : null;
    },

    // إنشاء حساب جديد
    createAccount(username, email) {
        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            plan: 'free',
            createdAt: new Date().toISOString(),
            notifications: []
        };
        localStorage.setItem('afnanUser', JSON.stringify(newUser));
        return newUser;
    },

    // تحديث خطة الاشتراك
    updatePlan(planName) {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        const plan = this.plans[planName];
        if (!plan) return false;

        user.plan = planName;
        user.planUpdatedAt = new Date().toISOString();
        
        localStorage.setItem('afnanUser', JSON.stringify(user));
        return true;
    },

    // إضافة إشعار
    addNotification(title, message, type = 'info', image = null) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const notification = {
            id: Date.now().toString(),
            title,
            message,
            type, // 'info', 'success', 'warning', 'error'
            image,
            createdAt: new Date().toISOString(),
            read: false
        };

        user.notifications = user.notifications || [];
        user.notifications.unshift(notification);

        // احتفظ بآخر 50 إشعار فقط
        if (user.notifications.length > 50) {
            user.notifications = user.notifications.slice(0, 50);
        }

        localStorage.setItem('afnanUser', JSON.stringify(user));
        return notification;
    },

    // الحصول على الإشعارات
    getNotifications() {
        const user = this.getCurrentUser();
        return user ? user.notifications || [] : [];
    },

    // الحصول على معلومات الخطة الحالية
    getCurrentPlanInfo() {
        const user = this.getCurrentUser();
        if (!user) return null;
        return this.plans[user.plan];
    }
};

// تهيئة الحساب عند أول زيارة
window.addEventListener('load', () => {
    if (!AccountSystem.getCurrentUser()) {
        // إنشاء حساب تجريبي
        AccountSystem.createAccount('مستخدم جديد', 'user@afnanai.com');
    }
});

// Pull to Refresh logic removed to allow native browser refresh
