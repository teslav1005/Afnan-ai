import { auth, db } from './api.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy, deleteDoc, arrayUnion, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let currentChatId = null;
let pendingAttachment = null;
let currentMode = null; 
let currentModel = 'Afnan-Fishe';
let messageCount = 0;
let unsubscribeHistory = null;
let longPressTimer = null;
let activeContextChatId = null;

const dom = {
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('overlay'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    chatWindow: document.getElementById('chatWindow'),
    messageBox: document.getElementById('messageBox'),
    emptyView: document.getElementById('emptyView'),
    logoutConfirm: document.getElementById('logoutConfirm'),
    confirmYes: document.getElementById('confirmYes'),
    confirmNo: document.getElementById('confirmNo'),
    attachBtn: document.getElementById('mainAttachBtn'),
    attachMenu: document.getElementById('mainAttachMenu'),
    newChatBtn: document.getElementById('newChatBtn'),
    historyList: document.getElementById('historyList'),
    attachmentPreview: document.getElementById('attachmentPreview'),
    imageViewer: document.getElementById('imageViewer'),
    viewerImg: document.getElementById('viewerImg'),
    deleteImageBtn: document.getElementById('deleteImageBtn'),
    activeModeIndicator: document.getElementById('activeModeIndicator'),
    modeIcon: document.getElementById('modeIcon'),
    cancelModeBtn: document.getElementById('cancelModeBtn'),
    modelSelectorTop: document.getElementById('modelSelectorTop'),
    currentModelBtn: document.getElementById('currentModelBtn'),
    modelDropdown: document.getElementById('modelDropdown'),
    activeModelName: document.getElementById('activeModelName'),
    historySearch: document.getElementById('historySearch'),
    contextMenu: document.getElementById('contextMenu'),
    pinnedList: document.getElementById('pinnedList'),
    favoritesList: document.getElementById('favoritesList'),
    recentList: document.getElementById('recentList'),
    pinnedSection: document.getElementById('pinnedSection'),
    favoritesSection: document.getElementById('favoritesSection')
};

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    const loginBtnHeader = document.getElementById('loginBtnHeader');
    const profileSection = document.getElementById('profileSection');

    if (!user) {
        currentUser = null;
        if (loginBtnHeader) loginBtnHeader.style.display = 'block';
        dom.modelSelectorTop.classList.add('hidden');
        profileSection.innerHTML = '';
        dom.historyList.innerHTML = '';
        if (unsubscribeHistory) unsubscribeHistory();
    } else {
        currentUser = user;
        if (loginBtnHeader) loginBtnHeader.style.display = 'none';
        dom.modelSelectorTop.classList.remove('hidden');
        profileSection.innerHTML = `
            <div id="profileTrigger" class="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer hover:bg-gray-200/50 transition-all">
                <img id="profileImg" src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="Profile" class="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm object-cover">
                <div class="flex-1 min-w-0 text-right">
                    <p id="profileName" class="text-xs font-bold truncate">${user.displayName || 'User'}</p>
                    <p id="profileEmail" class="text-[10px] text-gray-500 truncate">${user.email || ''}</p>
                </div>
                <i class="fa-solid fa-ellipsis-vertical text-gray-300 text-xs"></i>
            </div>
            <div id="profilePopup" class="glass p-2 space-y-1" style="display:none; position:absolute; bottom:70px; left:10px; width:220px; z-index:200; border-radius:1.5rem; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
<a href="privacy.html" class="block p-3 text-sm hover:bg-gray-100 rounded-xl transition-all">سياسة الخصوصية</a>
<a href="terms.html" class="block p-3 text-sm hover:bg-gray-100 rounded-xl transition-all">اتفاقية المستخدم</a>
                <button id="logoutBtn" class="w-full text-right p-3 text-sm hover:bg-gray-100 rounded-xl transition-all">تسجيل الخروج</button>
                <button id="deleteAccountBtn" class="w-full text-right p-3 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all">حذف الحساب</button>
            </div>
        `;
        setupProfileListeners();
        listenToChatHistory();
    }
});

const setupProfileListeners = () => {
    const trigger = document.getElementById('profileTrigger');
    const popup = document.getElementById('profilePopup');
    if (trigger) trigger.onclick = (e) => { e.stopPropagation(); popup.style.display = popup.style.display === 'block' ? 'none' : 'block'; };
    document.getElementById('logoutBtn').onclick = () => {
        dom.logoutConfirm.style.display = 'flex';
        dom.logoutConfirm.classList.remove('hidden');
        // Hide profile popup when logout confirm shows
        document.getElementById('profilePopup').style.display = 'none';
    };
    document.getElementById('deleteAccountBtn').onclick = () => window.navigateToPage('delete-account.html');
    
    // Logout confirmation logic
    document.getElementById('confirmYes').onclick = async () => {
        try {
            await signOut(auth);
            dom.logoutConfirm.style.display = 'none';
            window.location.reload();
        } catch (error) {
            console.error('Logout error:', error);
            window.toast("خطأ في تسجيل الخروج");
        }
    };
    document.getElementById('confirmNo').onclick = () => {
        dom.logoutConfirm.style.display = 'none';
    };
};

// Model Selector Logic
dom.currentModelBtn.onclick = (e) => {
    e.stopPropagation();
    dom.modelDropdown.classList.toggle('hidden');
};

window.selectModel = (model, shortName) => {
    currentModel = model;
    dom.activeModelName.textContent = model;
    dom.modelDropdown.classList.add('hidden');
    window.toast(`تم اختيار نموذج ${model}`);
};

// Sidebar Logic
const toggleSidebar = (val) => {
    const isVisible = val !== undefined ? val : dom.sidebar.classList.contains('-translate-x-full');
    dom.sidebar.classList.toggle('-translate-x-full', !isVisible);
    dom.overlay.classList.toggle('hidden', !isVisible);
    requestAnimationFrame(() => dom.overlay.style.opacity = isVisible ? '1' : '0');
};

document.getElementById('sidebarToggle').onclick = () => toggleSidebar();
dom.overlay.onclick = () => {
    toggleSidebar(false);
    dom.attachMenu.classList.add('hidden');
    dom.modelDropdown.classList.add('hidden');
    dom.contextMenu.style.display = 'none';
};

// Attachment Logic
const toggleAttachMenu = (e) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    dom.attachMenu.classList.toggle('hidden');
    console.log('Attach menu toggled:', !dom.attachMenu.classList.contains('hidden'));
};

// Use both click and touchstart for maximum responsiveness
dom.attachBtn.addEventListener('click', toggleAttachMenu);
dom.attachBtn.addEventListener('touchstart', (e) => {
    toggleAttachMenu(e);
}, { passive: false });

const imageInput = document.getElementById('imageInput');
const fileInput = document.getElementById('fileInput');

document.getElementById('optImage').onclick = () => imageInput.click();
document.getElementById('optFile').onclick = () => fileInput.click();
document.getElementById('optWeb').onclick = () => window.activateMode('web', 'fa-globe', '#22c55e');
document.getElementById('optBrain').onclick = () => window.activateMode('brain', 'fa-lightbulb', '#eab308');

window.activateMode = (mode, icon, color) => {
    currentMode = mode;
    dom.modeIcon.className = `fa-solid ${icon}`;
    dom.modeIcon.style.color = color;
    dom.activeModeIndicator.classList.remove('hidden');
    dom.activeModeIndicator.classList.add('flex');
    dom.attachMenu.classList.add('hidden');
};

dom.cancelModeBtn.onclick = () => {
    currentMode = null;
    dom.activeModeIndicator.classList.add('hidden');
    dom.activeModeIndicator.classList.remove('flex');
};

// Integrated Attachment Preview (Inside Input)
const showAttachmentPreview = (file, isImage) => {
    dom.attachmentPreview.innerHTML = '';
    dom.attachmentPreview.classList.remove('hidden');
    const reader = new FileReader();
    reader.onload = (e) => {
        pendingAttachment = { name: file.name, data: e.target.result, type: isImage ? 'image' : 'file' };
        const item = document.createElement('div');
        item.className = 'relative w-20 h-20 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group p-1 animate-pop';
        if (isImage) {
            item.innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover rounded-lg cursor-pointer" onclick="window.openImageViewer('${e.target.result}')">
                <button onclick="window.removeAttachment()" class="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center text-[10px] border border-white shadow-sm"><i class="fa-solid fa-xmark"></i></button>
            `;
        } else {
            item.innerHTML = `
                <div class="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg">
                    <i class="fa-solid fa-file text-gray-400 text-xl"></i>
                    <span class="text-[8px] px-1 truncate w-full text-center mt-1">${file.name}</span>
                </div>
                <button onclick="window.removeAttachment()" class="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center text-[10px] border border-white shadow-sm"><i class="fa-solid fa-xmark"></i></button>
            `;
        }
        dom.attachmentPreview.appendChild(item);
    };
    reader.readAsDataURL(file);
};

window.removeAttachment = () => {
    pendingAttachment = null;
    dom.attachmentPreview.innerHTML = '';
    dom.attachmentPreview.classList.add('hidden');
    imageInput.value = '';
    fileInput.value = '';
};

imageInput.onchange = (e) => { if (e.target.files[0]) showAttachmentPreview(e.target.files[0], true); dom.attachMenu.classList.add('hidden'); };
fileInput.onchange = (e) => { if (e.target.files[0]) showAttachmentPreview(e.target.files[0], false); dom.attachMenu.classList.add('hidden'); };

// Chat History & Real-time Sync
const listenToChatHistory = () => {
    if (!currentUser) return;
    if (unsubscribeHistory) unsubscribeHistory();

    const q = query(collection(db, 'chats'), where('userId', '==', currentUser.uid), orderBy('updatedAt', 'desc'));
    unsubscribeHistory = onSnapshot(q, (snap) => {
        renderHistory(snap);
    });
};

const renderHistory = (snap) => {
    dom.pinnedList.innerHTML = '';
    dom.favoritesList.innerHTML = '';
    dom.recentList.innerHTML = '';
    
    let hasPinned = false, hasFav = false;
    const searchTerm = dom.historySearch.value.toLowerCase();

    snap.forEach((docSnap) => {
        const chat = docSnap.data();
        const chatId = docSnap.id;
        if (searchTerm && !chat.title.toLowerCase().includes(searchTerm)) return;

        const item = createHistoryItem(chatId, chat);
        
        if (chat.isPinned) {
            dom.pinnedList.appendChild(item);
            hasPinned = true;
        } else if (chat.isFavorite) {
            dom.favoritesList.appendChild(item);
            hasFav = true;
        } else {
            dom.recentList.appendChild(item);
        }
    });

    dom.pinnedSection.classList.toggle('hidden', !hasPinned);
    dom.favoritesSection.classList.toggle('hidden', !hasFav);
};

const createHistoryItem = (chatId, chat) => {
    const item = document.createElement('div');
    item.className = `group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-100 transition-all cursor-pointer text-sm text-gray-700 ${currentChatId === chatId ? 'bg-gray-100' : ''}`;
    item.innerHTML = `<div class="flex-1 min-w-0"><p class="truncate font-bold text-xs">${chat.title || 'محادثة جديدة'}</p></div>`;
    
    // Long Press Events
    item.onmousedown = (e) => startLongPress(e, chatId);
    item.ontouchstart = (e) => startLongPress(e, chatId);
    item.onmouseup = endLongPress;
    item.ontouchend = endLongPress;
    item.onclick = () => window.loadChat(chatId);
    
    return item;
};

const startLongPress = (e, chatId) => {
    longPressTimer = setTimeout(() => {
        activeContextChatId = chatId;
        showContextMenu(e);
    }, 600);
};

const endLongPress = () => clearTimeout(longPressTimer);

const showContextMenu = (e) => {
    const x = e.pageX || e.touches[0].pageX;
    const y = e.pageY || e.touches[0].pageY;
    dom.contextMenu.style.left = `${x}px`;
    dom.contextMenu.style.top = `${y}px`;
    dom.contextMenu.style.display = 'block';
};

// Context Menu Actions
document.getElementById('ctxPin').onclick = async () => {
    await updateDoc(doc(db, 'chats', activeContextChatId), { isPinned: true, isFavorite: false });
    dom.contextMenu.style.display = 'none';
};
document.getElementById('ctxFav').onclick = async () => {
    await updateDoc(doc(db, 'chats', activeContextChatId), { isFavorite: true, isPinned: false });
    dom.contextMenu.style.display = 'none';
};
document.getElementById('ctxDel').onclick = async () => {
    if (confirm("حذف المحادثة؟")) await deleteDoc(doc(db, 'chats', activeContextChatId));
    dom.contextMenu.style.display = 'none';
};

// Chat Logic
window.loadChat = async (chatId) => {
    currentChatId = chatId;
    dom.messageBox.innerHTML = '';
    dom.emptyView.style.display = 'none';
    const snap = await getDocs(query(collection(db, 'chats'), where('__name__', '==', chatId)));
    if (!snap.empty) {
        snap.docs[0].data().messages.forEach(msg => appendMessage(msg.sender, msg.text, msg.attachment));
    }
    dom.chatWindow.scrollTop = dom.chatWindow.scrollHeight;
    if(window.innerWidth < 768) toggleSidebar(false);
};

const appendMessage = (sender, text, attachment) => {
    const div = document.createElement('div');
    div.className = `flex w-full ${sender === 'user' ? 'justify-end' : 'justify-start'} animate-pop mb-4`;
    
    let content = text;
    if (attachment) {
        if (attachment.type === 'image') content = `<img src="${attachment.data}" class="max-w-xs rounded-2xl shadow-sm mb-2 cursor-pointer" onclick="window.openImageViewer('${attachment.data}')"><p>${text}</p>`;
        else content = `<div class="flex items-center gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100 mb-2"><i class="fa-solid fa-file text-gray-400"></i><span class="text-xs font-bold">${attachment.name}</span></div><p>${text}</p>`;
    }

    if (sender === 'user') {
        div.innerHTML = `<div class="bg-[#F4F4F4] px-5 py-3.5 rounded-[1.8rem] rounded-tr-md max-w-[75%] text-gray-800 text-[14px] shadow-sm ml-4">${content}</div>`;
    } else {
        div.innerHTML = `
            <div class="flex flex-col items-start max-w-[75%] mr-4">
                <div class="bg-white border border-gray-100 px-5 py-3.5 rounded-[1.8rem] rounded-tl-md text-gray-800 text-[14px] shadow-sm mb-2">${content}</div>
                <div class="flex items-center gap-4 px-2 text-gray-300">
                    <i class="fa-regular fa-copy hover:text-gray-600 cursor-pointer transition-all" onclick="window.copyText('${text}')"></i>
                    <i class="fa-regular fa-thumbs-up hover:text-blue-500 cursor-pointer transition-all"></i>
                    <i class="fa-regular fa-thumbs-down hover:text-red-500 cursor-pointer transition-all"></i>
                    <i class="fa-solid fa-share-nodes hover:text-green-500 cursor-pointer transition-all"></i>
                </div>
            </div>
        `;
    }
    dom.messageBox.appendChild(div);
    dom.chatWindow.scrollTop = dom.chatWindow.scrollHeight;
};

window.copyText = (text) => {
    navigator.clipboard.writeText(text);
    window.toast("تم نسخ النص");
};

window.handleSend = async () => {
    const val = dom.chatInput.value.trim();
    if (!val && !pendingAttachment) return;

    // Check message limit for Fishe model before login
    if (currentModel === 'Afnan-Fishe' && !currentUser) {
        messageCount++;
        if (messageCount > 3) {
            window.navigateToPage('login.html');
            return;
        }
    } else if (!currentUser) {
        window.navigateToPage('login.html');
        return;
    }

    dom.emptyView.style.display = 'none';
    appendMessage('user', val, pendingAttachment);
    
    const currentText = val;
    const currentAttach = pendingAttachment;
    const activeMode = currentMode;
    const activeModel = currentModel;
    
    dom.chatInput.value = '';
    window.removeAttachment();

    const typing = document.createElement('div');
    typing.className = 'flex justify-start mb-4 animate-pop';
    typing.innerHTML = `<div class="bg-white border border-gray-100 px-5 py-3.5 rounded-[1.8rem] rounded-tl-md shadow-sm"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
    dom.messageBox.appendChild(typing);
    dom.chatWindow.scrollTop = dom.chatWindow.scrollHeight;

    try {
        const aiRes = `هذا رد تجريبي من نموذج ${activeModel} باستخدام وضع ${activeMode || 'الافتراضي'}.`;
        typing.remove();
        appendMessage('bot', aiRes);

        const msgUser = { sender: 'user', text: currentText, attachment: currentAttach, mode: activeMode, model: activeModel, timestamp: new Date() };
        const msgBot = { sender: 'bot', text: aiRes, timestamp: new Date() };

        if (!currentChatId) {
            const docRef = await addDoc(collection(db, 'chats'), {
                userId: currentUser.uid,
                title: currentText.substring(0, 30),
                messages: [msgUser, msgBot],
                isPinned: false,
                isFavorite: false,
                updatedAt: serverTimestamp()
            });
            currentChatId = docRef.id;
        } else {
            await updateDoc(doc(db, 'chats', currentChatId), {
                messages: arrayUnion(msgUser, msgBot),
                updatedAt: serverTimestamp()
            });
        }
    } catch (e) { console.error(e); typing.remove(); }
};

dom.sendBtn.onclick = window.handleSend;
dom.chatInput.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.handleSend(); } };
dom.historySearch.oninput = () => listenToChatHistory();

window.toast = (msg) => {
    const t = document.createElement('div');
    t.className = 'glass px-4 py-2 rounded-full text-xs fixed bottom-24 left-1/2 -translate-x-1/2 z-[5000] shadow-xl animate-pop';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
};

window.navigateToPage = (page) => window.location.href = page;
window.addEventListener('click', (e) => {
    if (!dom.modelSelectorTop.contains(e.target)) {
        dom.modelDropdown.classList.add('hidden');
    }
    if (!dom.contextMenu.contains(e.target)) {
        dom.contextMenu.style.display = 'none';
    }
    if (!dom.attachBtn.contains(e.target) && !dom.attachMenu.contains(e.target)) {
        dom.attachMenu.classList.add('hidden');
    }
});
