import { auth, db } from './api.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy, deleteDoc, arrayUnion, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global Variables
let currentUser = null;
let currentChatId = null;
let currentMode = 'chat'; // chat, image, video
let activeModelId = 'mistral-small-3.2';
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

// DOM Elements
const getEl = (id) => document.getElementById(id);
const dom = {
    adaptiveModelList: getEl('adaptiveModelList'),
    modePopup: getEl('modePopup'),
    settingsPanel: getEl('settingsPanel'),
    panelTitle: getEl('panelTitle'),
    modeIndicator: getEl('modeIndicator'),
    videoOptions: getEl('videoOptions'),
    imageOptions: getEl('imageOptions'),
    attachIcon: getEl('attachIcon'),
    mainAttachBtn: getEl('mainAttachBtn'),
    chatInput: getEl('chatInput'),
    sendBtn: getEl('sendBtn'),
    messageBox: getEl('messageBox'),
    emptyView: getEl('emptyView'),
    chatWindow: getEl('chatWindow'),
    profileTrigger: getEl('profileTrigger'),
    profilePopup: getEl('profilePopup'),
    logoutConfirm: getEl('logoutConfirm'),
    confirmYes: getEl('confirmYes'),
    confirmNo: getEl('confirmNo'),
    langToggle: getEl('langToggle'),
    sidebar: getEl('sidebar'),
    sidebarToggle: getEl('sidebarToggle'),
    overlay: getEl('overlay'),
    recentList: getEl('recentList')
};

// i18n
i18next
    .use(i18nextHttpBackend)
    .use(i18nextBrowserLanguageDetector)
    .init({
        fallbackLng: 'ar',
        backend: { loadPath: 'lang/{{lng}}.json' }
    }, (err, t) => { updateUIStrings(); renderAdaptiveModels(); });

function updateUIStrings() {
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
    i18next.changeLanguage(next, () => { updateUIStrings(); });
};
dom.langToggle.onclick = window.toggleLanguage;

// Auth
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        getEl('loginBtnHeader').style.display = 'none';
        getEl('profileName').textContent = user.displayName || 'User';
        getEl('userNameDisplay').textContent = user.displayName || 'User';
        getEl('userEmailDisplay').textContent = user.email || '';
        getEl('userPhoto').src = user.photoURL || 'logo.jpg';
        listenToHistory();
    } else {
        getEl('loginBtnHeader').style.display = 'block';
    }
});

// Dynamic UI Logic
function renderAdaptiveModels() {
    const models = modelsData[currentMode];
    dom.adaptiveModelList.innerHTML = models.map(m => `
        <button onclick="window.selectModel('${m.id}')" class="model-chip ${activeModelId === m.id ? 'active' : ''}">${m.name}</button>
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
    
    // Update Icons & UI
    if (mode === 'chat') {
        dom.attachIcon.className = 'fa-solid fa-plus text-xl';
        dom.settingsPanel.style.display = 'none';
        dom.modeIndicator.className = 'w-2 h-2 rounded-full bg-gray-300';
    } else {
        dom.attachIcon.className = mode === 'image' ? 'fa-solid fa-wand-magic-sparkles text-blue-500' : 'fa-solid fa-clapperboard text-purple-500';
        dom.modeIndicator.className = `w-2 h-2 rounded-full ${mode === 'image' ? 'bg-blue-500' : 'bg-purple-500'}`;
        dom.panelTitle.textContent = i18next.t(mode === 'image' ? 'generator.title_image' : 'generator.title_video');
        dom.imageOptions.classList.toggle('hidden', mode === 'video');
        dom.videoOptions.classList.toggle('hidden', mode === 'image');
        dom.settingsPanel.style.display = 'block';
    }
    
    renderAdaptiveModels();
};

window.hideSettings = () => dom.settingsPanel.style.display = 'none';

// Interaction Listeners
dom.mainAttachBtn.onclick = (e) => {
    e.stopPropagation();
    dom.modePopup.style.display = dom.modePopup.style.display === 'block' ? 'none' : 'block';
};

dom.profileTrigger.onclick = (e) => {
    e.stopPropagation();
    dom.profilePopup.style.display = dom.profilePopup.style.display === 'block' ? 'none' : 'block';
};

window.onclick = () => {
    dom.modePopup.style.display = 'none';
    dom.profilePopup.style.display = 'none';
};

// Settings Selection
document.querySelectorAll('.size-opt').forEach(btn => {
    btn.onclick = () => {
        genSettings.size = btn.dataset.size;
        document.querySelectorAll('.size-opt').forEach(b => b.classList.toggle('active', b.dataset.size === genSettings.size));
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

// Messaging Logic
window.handleSend = async () => {
    const val = dom.chatInput.value.trim();
    if (!val || !currentUser) return;

    dom.emptyView.style.display = 'none';
    appendMessage('user', val);
    dom.chatInput.value = '';
    const typing = appendTyping();

    try {
        // Simulating Professional AI Response with Download Button for Media
        const isMedia = currentMode !== 'chat';
        const aiRes = i18next.t('chat.experimental_response', { model: activeModelId });
        typing.remove();
        
        appendMessage('bot', aiRes, isMedia);

        const fullMsg = val + (isMedia ? `\n[System: ${currentMode.toUpperCase()} Mode | Model: ${activeModelId} | Size: ${genSettings.size}]` : "");
        
        const chatData = {
            userId: currentUser.uid,
            title: val.substring(0, 30),
            messages: arrayUnion(
                { sender: 'user', text: fullMsg, timestamp: new Date() },
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
                    { sender: 'user', text: fullMsg, timestamp: new Date() },
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
            <div class="mt-4 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="fa-solid ${currentMode === 'image' ? 'fa-image' : 'fa-video'} text-gray-400"></i>
                    <span class="text-[10px] font-bold text-gray-500">${currentMode.toUpperCase()} OUTPUT</span>
                </div>
                <button class="bg-black text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                    <i class="fa-solid fa-download mr-1"></i> Download
                </button>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="${sender === 'user' ? 'bg-gray-100 text-gray-800' : 'bg-white border border-gray-100 shadow-sm'} px-6 py-4 rounded-[2rem] max-w-[85%] text-[14px] font-medium leading-relaxed ${sender === 'user' ? (isAr ? 'rounded-tr-none' : 'rounded-tl-none') : (isAr ? 'rounded-tl-none' : 'rounded-tr-none')}">
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
    div.innerHTML = `<div class="bg-white border border-gray-100 px-6 py-4 rounded-[2rem] shadow-sm flex gap-1"><div class="w-1.5 h-1.5 bg-gray-200 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-gray-200 rounded-full animate-bounce" style="animation-delay: 0.2s"></div><div class="w-1.5 h-1.5 bg-gray-200 rounded-full animate-bounce" style="animation-delay: 0.4s"></div></div>`;
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
            item.className = `sidebar-item p-3.5 cursor-pointer text-xs font-bold truncate ${currentChatId === docSnap.id ? 'bg-gray-100' : ''}`;
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

dom.sidebarToggle.onclick = () => { dom.sidebar.classList.remove('-translate-x-full'); dom.overlay.classList.remove('hidden'); };
dom.overlay.onclick = () => { dom.sidebar.classList.add('-translate-x-full'); dom.overlay.classList.add('hidden'); };
dom.newChatBtn.onclick = () => { currentChatId = null; dom.messageBox.innerHTML = ''; dom.emptyView.style.display = 'flex'; };
dom.confirmYes.onclick = async () => { await signOut(auth); window.location.reload(); };
dom.confirmNo.onclick = () => { dom.logoutConfirm.classList.add('hidden'); dom.logoutConfirm.style.display = 'none'; };

window.navigateTo = (url) => window.location.href = url;
