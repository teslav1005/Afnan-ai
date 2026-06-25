import { auth, db } from './api.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy, deleteDoc, arrayUnion, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global State
let currentUser = null;
let currentChatId = null;
let currentMode = 'chat';
let activeModelId = 'mistral-small-3.2';
let isThinking = false;
let genSettings = { size: '1:1', duration: 5, count: 1 };

// Models Data
const modelsData = {
    chat: [
        { id: 'mistral-small-3.2', name: 'mistral-small-3.2' },
        { id: 'mercury', name: 'Mercury 2' },
        { id: 'midijourney', name: 'midijourney' },
        { id: 'openai-large', name: 'Gpt-5.5' },
        { id: 'gemini-large', name: 'Gemini-3.1Pro' },
        { id: 'claude-large', name: 'Claude Opus 4.8' },
        { id: 'deepseek-pro', name: 'deepseek-v4-Pro' }
    ],
    image: [
        { id: 'nanobanana-2', name: 'nanobanana-2' },
        { id: 'gpt-image-2', name: 'gpt-image-2' },
        { id: 'nova-canvas', name: 'nova-canvas' }
    ],
    video: [
        { id: 'ltx-2', name: 'Ltx2.3' },
        { id: 'seedance-pro', name: 'seedance-pro' },
        { id: 'veo', name: 'Veo3.1' }
    ]
};

// DOM Cache
const getEl = (id) => document.getElementById(id);
const dom = {
    adaptiveModelList: getEl('adaptiveModelList'),
    modePopup: getEl('modePopup'),
    settingsPanel: getEl('settingsPanel'),
    thinkingToggle: getEl('thinkingToggle'),
    profileTrigger: getEl('profileTrigger'),
    profileMenu: getEl('profileMenu'),
    sidebar: getEl('sidebar'),
    overlay: getEl('overlay'),
    chatInput: getEl('chatInput'),
    sendBtn: getEl('sendBtn'),
    messageBox: getEl('messageBox'),
    emptyView: getEl('emptyView'),
    chatWindow: getEl('chatWindow'),
    profileName: getEl('profileName'),
    profileEmail: getEl('profileEmail'),
    userPhoto: getEl('userPhoto'),
    recentList: getEl('recentList'),
    langToggle: getEl('langToggle'),
    logoutConfirm: getEl('logoutConfirm'),
    confirmYes: getEl('confirmYes'),
    confirmNo: getEl('confirmNo')
};

// i18n
i18next
    .use(i18nextHttpBackend)
    .use(i18nextBrowserLanguageDetector)
    .init({
        fallbackLng: 'ar',
        backend: { loadPath: 'lang/{{lng}}.json' }
    }, (err, t) => { updateUI(); renderAdaptiveModels(); });

function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key.startsWith('[placeholder]')) el.placeholder = i18next.t(key.replace('[placeholder]', ''));
        else el.innerHTML = i18next.t(key);
    });
    const lang = i18next.language.startsWith('en') ? 'en' : 'ar';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    dom.langToggle.textContent = lang === 'ar' ? 'EN' : 'AR';
}

window.toggleLanguage = () => {
    const next = i18next.language.startsWith('ar') ? 'en' : 'ar';
    i18next.changeLanguage(next, () => { updateUI(); });
};
dom.langToggle.onclick = window.toggleLanguage;

// Auth
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        getEl('loginBtnHeader').style.display = 'none';
        dom.profileName.textContent = user.displayName || 'User';
        dom.profileEmail.textContent = user.email || '';
        dom.userPhoto.src = user.photoURL || 'logo.jpg';
        listenToHistory();
    } else {
        getEl('loginBtnHeader').style.display = 'block';
    }
});

// UI Handlers
function renderAdaptiveModels() {
    const models = modelsData[currentMode];
    dom.adaptiveModelList.innerHTML = models.map(m => `
        <button onclick="window.selectModel('${m.id}')" class="mode-chip ${activeModelId === m.id ? 'active' : ''}">${m.name}</button>
    `).join('');
}

window.selectModel = (id) => {
    activeModelId = id;
    renderAdaptiveModels();
};

window.switchMode = (mode) => {
    currentMode = mode;
    activeModelId = modelsData[mode][0].id;
    dom.modePopup.style.display = 'none';
    
    const isChat = mode === 'chat';
    getEl('attachIcon').className = isChat ? 'fa-solid fa-plus text-xl' : (mode === 'image' ? 'fa-solid fa-sparkles text-blue-500' : 'fa-solid fa-film text-purple-500');
    getEl('modeIndicator').className = `w-2.5 h-2.5 rounded-full shadow-sm ${isChat ? 'bg-gray-200' : (mode === 'image' ? 'bg-blue-500' : 'bg-purple-500')}`;
    getEl('panelTitle').textContent = i18next.t(mode === 'image' ? 'generator.title_image' : 'generator.title_video');
    getEl('imageOptions').classList.toggle('hidden', mode === 'video');
    getEl('videoOptions').classList.toggle('hidden', mode === 'image');
    dom.settingsPanel.style.display = isChat ? 'none' : 'block';
    getEl('chatOptions').style.display = isChat ? 'flex' : 'none';
    
    renderAdaptiveModels();
};

window.hideSettings = () => dom.settingsPanel.style.display = 'none';

dom.thinkingToggle.onclick = () => {
    isThinking = !isThinking;
    dom.thinkingToggle.classList.toggle('active', isThinking);
};

dom.profileTrigger.onclick = (e) => {
    e.stopPropagation();
    dom.profileMenu.style.display = dom.profileMenu.style.display === 'block' ? 'none' : 'block';
};

dom.mainAttachBtn.onclick = (e) => {
    e.stopPropagation();
    dom.modePopup.style.display = dom.modePopup.style.display === 'block' ? 'none' : 'block';
};

// Global Click (Close Popups & Sidebar)
window.onclick = (e) => {
    dom.modePopup.style.display = 'none';
    dom.profileMenu.style.display = 'none';
    if (dom.overlay.contains(e.target)) {
        dom.sidebar.classList.add('-translate-x-full');
        dom.overlay.classList.add('hidden');
    }
};

// Settings
document.querySelectorAll('.size-btn').forEach(btn => {
    btn.onclick = () => {
        genSettings.size = btn.dataset.size;
        document.querySelectorAll('.size-btn').forEach(b => b.classList.toggle('active', b.dataset.size === genSettings.size));
    };
});
document.querySelectorAll('.count-opt').forEach(btn => {
    btn.onclick = () => {
        genSettings.count = btn.dataset.count;
        document.querySelectorAll('.count-opt').forEach(b => b.classList.toggle('active', b.dataset.count === genSettings.count));
    };
});
document.querySelectorAll('.dur-opt').forEach(btn => {
    btn.onclick = () => {
        genSettings.duration = btn.dataset.dur;
        document.querySelectorAll('.dur-opt').forEach(b => b.classList.toggle('active', b.dataset.dur === genSettings.duration));
    };
});

// Send Message
window.handleSend = async () => {
    const val = dom.chatInput.value.trim();
    if (!val || !currentUser) return;

    dom.emptyView.style.display = 'none';
    appendMessage('user', val);
    dom.chatInput.value = '';
    const typing = appendTyping();

    try {
        const isMedia = currentMode !== 'chat';
        const aiRes = i18next.t('chat.experimental_response', { model: activeModelId });
        typing.remove();
        appendMessage('bot', aiRes, isMedia);

        const systemTag = isMedia ? `\n[System: ${currentMode.toUpperCase()} | Model: ${activeModelId} | Size: ${genSettings.size}]` : (isThinking ? "\n[Thinking Mode Active]" : "");
        
        const chatData = {
            userId: currentUser.uid,
            title: val.substring(0, 30),
            messages: arrayUnion(
                { sender: 'user', text: val + systemTag, timestamp: new Date() },
                { sender: 'bot', text: aiRes, isMedia: isMedia, timestamp: new Date() }
            ),
            updatedAt: serverTimestamp()
        };

        if (!currentChatId) {
            const docRef = await addDoc(collection(db, 'chats'), chatData);
            currentChatId = docRef.id;
        } else {
            await updateDoc(doc(db, 'chats', currentChatId), {
                messages: arrayUnion(
                    { sender: 'user', text: val + systemTag, timestamp: new Date() },
                    { sender: 'bot', text: aiRes, isMedia: isMedia, timestamp: new Date() }
                ),
                updatedAt: serverTimestamp()
            });
        }
    } catch (e) { console.error(e); typing.remove(); }
};

dom.sendBtn.onclick = window.handleSend;
dom.chatInput.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.handleSend(); } };

function appendMessage(sender, text, isMedia = false) {
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'flex justify-end' : 'flex justify-start';
    const isAr = i18next.language.startsWith('ar');
    
    let mediaHTML = "";
    if (isMedia && sender === 'bot') {
        mediaHTML = `
            <div class="mt-6 p-4 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between shadow-inner">
                <div class="flex items-center gap-3">
                    <i class="fa-solid ${currentMode === 'image' ? 'fa-image' : 'fa-video'} text-gray-400 text-lg"></i>
                    <span class="text-[11px] font-black text-gray-500 tracking-widest">${currentMode.toUpperCase()} OUTPUT</span>
                </div>
                <button class="bg-black text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md">
                    <i class="fa-solid fa-download mr-1"></i> Download
                </button>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="${sender === 'user' ? 'bg-gray-100 text-gray-800' : 'bg-white border border-gray-100 shadow-sm'} px-8 py-5 rounded-[2.5rem] max-w-[85%] text-[15px] font-medium leading-relaxed ${sender === 'user' ? (isAr ? 'rounded-tr-none' : 'rounded-tl-none') : (isAr ? 'rounded-tl-none' : 'rounded-tr-none')}">
            ${text}
            ${mediaHTML}
        </div>
    `;
    dom.messageBox.appendChild(div);
    dom.chatWindow.scrollTop = dom.chatWindow.scrollHeight;
}

function appendTyping() {
    const div = document.createElement('div');
    div.className = 'flex justify-start';
    div.innerHTML = `<div class="bg-white border border-gray-100 px-8 py-5 rounded-[2.5rem] shadow-sm flex gap-1.5"><div class="w-2 h-2 bg-gray-200 rounded-full animate-bounce"></div><div class="w-2 h-2 bg-gray-200 rounded-full animate-bounce" style="animation-delay: 0.2s"></div><div class="w-2 h-2 bg-gray-200 rounded-full animate-bounce" style="animation-delay: 0.4s"></div></div>`;
    dom.messageBox.appendChild(div);
    dom.chatWindow.scrollTop = dom.chatWindow.scrollHeight;
    return div;
}

// History & Sidebar
function listenToHistory() {
    const q = query(collection(db, 'chats'), where('userId', '==', currentUser.uid), orderBy('updatedAt', 'desc'));
    unsubscribeHistory = onSnapshot(q, (snap) => {
        dom.recentList.innerHTML = '';
        snap.forEach(docSnap => {
            const item = document.createElement('div');
            item.className = `sidebar-item ${currentChatId === docSnap.id ? 'active' : ''}`;
            item.textContent = docSnap.data().title || 'New Chat';
            item.onclick = () => loadChat(docSnap.id);
            dom.recentList.appendChild(item);
        });
    });
}

async function loadChat(id) {
    currentChatId = id;
    dom.messageBox.innerHTML = '';
    dom.emptyView.style.display = 'none';
    const docSnap = await getDocs(query(collection(db, 'chats'), where('__name__', '==', id)));
    if (!docSnap.empty) {
        docSnap.docs[0].data().messages.forEach(m => appendMessage(m.sender, m.text, m.isMedia));
    }
}

getEl('sidebarToggle').onclick = () => { dom.sidebar.classList.remove('-translate-x-full'); dom.overlay.classList.remove('hidden'); };
dom.newChatBtn.onclick = () => { currentChatId = null; dom.messageBox.innerHTML = ''; dom.emptyView.style.display = 'flex'; };
dom.confirmYes.onclick = async () => { await signOut(auth); window.location.reload(); };
dom.confirmNo.onclick = () => { dom.logoutConfirm.classList.add('hidden'); };
window.navigateTo = (url) => window.location.href = url;
