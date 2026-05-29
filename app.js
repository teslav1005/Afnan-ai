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
        free: { name: 'Free', credits: 300, price: 0, period: 'يومي' },
        pro: { name: 'Pro', credits: 900, price: 10, period: 'شهري' },
        ultra: { name: 'Ultra', credits: 6300, price: 20, period: 'شهري' }
    },

    // الموصلات المتاحة
    connectors: [
        { id: 'gmail', name: 'Gmail', img: 'https://i.postimg.cc/hXnTxNxx/Email.png' },
        { id: 'gdrive', name: 'Google Drive', img: 'https://i.postimg.cc/yDKc929g/Drive.png' },
        { id: 'gethelp', name: 'Gethelp', img: 'https://i.postimg.cc/tsbWP8P7/Getep.png' },
        { id: 'vercel', name: 'Vercel', img: 'https://i.postimg.cc/LJSLfGfZ/vercl.png' }
    ],

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
            credits: 300,
            connectors: this.connectors.map(c => ({ ...c, enabled: false })),
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
        user.credits = plan.credits;
        user.planUpdatedAt = new Date().toISOString();
        
        localStorage.setItem('afnanUser', JSON.stringify(user));
        return true;
    },

    // تفعيل/تعطيل موصل
    toggleConnector(connectorId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const connector = user.connectors.find(c => c.id === connectorId);
        if (!connector) return false;

        connector.enabled = !connector.enabled;
        connector.enabledAt = new Date().toISOString();

        localStorage.setItem('afnanUser', JSON.stringify(user));
        return connector.enabled;
    },

    // الحصول على الموصلات المفعلة
    getEnabledConnectors() {
        const user = this.getCurrentUser();
        return user ? user.connectors.filter(c => c.enabled) : [];
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

    // تحديث الكريدت
    updateCredits(amount) {
        const user = this.getCurrentUser();
        if (!user) return false;

        user.credits = Math.max(0, user.credits + amount);
        localStorage.setItem('afnanUser', JSON.stringify(user));
        return user.credits;
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
