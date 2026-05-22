// نظام المعرفات الفريدة للصفحات (27 رمز)
const PAGE_IDS = {
    'index.html': 'A1b2C3d4E5f6G7h8I9j0K1l2M3n',
    'login.html': 'B2c3D4e5F6g7H8i9J0k1L2m3N4o',
    'Mahmoud.html': 'C3d4E5f6G7h8I9j0K1l2M3n4O5p', // سياسة الخصوصية
    'Mahmoud2.html': 'D4e5F6g7H8i9J0k1L2m3N4o5P6q', // اتفاقية المستخدم
    'Mahmoud3.html': 'E5f6G7h8I9j0K1l2M3n4O5p6Q7r'  // حذف الحساب
};

function maskURL() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const pageId = PAGE_IDS[currentPath];
    
    if (pageId) {
        // إخفاء اسم الصفحة واستبداله بالمعرف الفريد في شريط العنوان فقط
        const newURL = window.location.origin + window.location.pathname.replace(currentPath, '') + '?' + pageId;
        window.history.replaceState({ page: currentPath }, '', newURL);
    }
}

// دالة للانتقال بين الصفحات باستخدام المعرفات
window.navigateToPage = function(pageName) {
    const pageId = PAGE_IDS[pageName];
    if (pageId) {
        window.location.href = pageName;
    } else {
        window.location.href = pageName;
    }
};

// تنفيذ الإخفاء عند تحميل الصفحة
window.addEventListener('load', maskURL);

// منع الوصول المباشر لأسماء الملفات إذا لم يكن هناك معرف (اختياري ولكن يفضل تركه للمتصفح للتعامل مع الملفات)
// ملاحظة: بما أننا في بيئة استضافة ثابتة (GitHub Pages)، لا يمكننا منع الوصول للملفات الحقيقية برمجياً 
// من جهة الخادم، لذا نكتفي بتجميل الروابط من جهة العميل.
