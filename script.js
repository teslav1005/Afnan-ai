import { auth, db } from './api.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy, deleteDoc, arrayUnion, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global Variables
let currentUser = null;
let currentChatId = null;
let currentMode = 'chat'; // chat, image, video
let unsubscribeHistory = null;
let genSettings = { model: 'nanobanana-2', size: '1:1', duration: 5, count: 1 };

// DOM Elements
const getEl = (id) => document.getElementById(id);
const dom = {
    langToggle: getEl('langToggle'),
    sidebar: getEl('sidebar'),
    sidebarToggle: getEl('sidebarToggle'),
    overlay: getEl('overlay'),
    chatInput: getEl('chatInput'),
    sendBtn: getEl('sendBtn'),
    messageBox: getEl('messageBox'),
    emptyView: getEl('emptyView'),
    chatWindow: getEl('chatWindow'),
    newChatBtn: getEl('newChatBtn'),
    recentList: getEl('recentList'),
    modePopup: getEl('modePopup'),
    settingsPanel: getEl('settingsPanel'),
    panelTitle: getEl('panelTitle'),
    genModel: getEl('genModel'),
    videoOptions: getEl('videoOptions'),
    imageOptions: getEl('imageOptions'),
    attachIcon: getEl('attachIcon'),
    mainAttachBtn: getEl('mainAttachBtn'),
    profileSection: getEl('profileSection'),
    loginBtnHeader: getEl('loginBtnHeader'),
    logoutConfirm: getEl('logoutConfirm'),
    confirmYes: getEl('confirmYes'),
    confirmNo: getEl('confirmNo')
};

// Models Data
const imageModels = [{ id: 'nanobanana-2', name: 'nanobanana-2' }, { id: 'gpt-image-2', name: 'gpt-image-2' }, { id: 'nova-canvas', name: 'nova-canvas' }];
const videoModels = [{ id: 'ltx-2', name: 'Ltx2.3' }, { id: 'seedance-pro', name: 'seedance-pro' }, { id: 'veo', name: 'Veo3.1' }];
const chatModels = [
    { id: 'mistral-small-3.2', name: 'mistral-small-3.2' },
    { id: 'mercury', name: 'Mercury 2' },
    { id: 'midijourney', name: 'midijourney' },
    { id: 'openai-large', name: 'Gpt-5.5' },
    { id: 'gemini-large', name: 'Gemini-3.1Pro' },
    { id: 'claude-large', name: 'Claude Opus 4.8' },
    { id: 'deepseek-pro', name: 'deepseek-v4-Pro' }
];

// i18n Initialization
i18next
    .use(i18nextHttpBackend)
    .use(i18nextBrowserLanguageDetector)
    .init({
        fallbackLng: 'ar',
        backend: { loadPath: 'lang/{{lng}}.json' }
    }, (err, t) => { updateUIStrings(); });

function updateUIStrings() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key.startsWith('[placeholder]')) el.placeholder = i18next.t(key.replace('[placeholder]', ''));
        else el.innerHTML = i18next.t(key);
    });
    const lang = i18next.language.startsWith('en') ? 'en' : 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    dom.langToggle.textContent = lang === 'ar' ? 'EN' : 'AR';
}

window.toggleLanguage = () => {
    const next = i18next.language.startsWith('ar') ? 'en' : 'ar';
    i18next.changeLanguage(next, () => { updateUIStrings(); });
};
dom.langToggle.onclick = window.toggleLanguage;

// Auth State
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        dom.loginBtnHeader.style.display = 'none';
        renderProfile();
        listenToHistory();
    } else {
        dom.loginBtnHeader.style.display = 'block';
        dom.profileSection.innerHTML = '';
        dom.recentList.innerHTML = '';
    }
});

function renderProfile() {
    dom.profileSection.innerHTML = `
        <div id="profileTrigger" class="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 rounded-xl">
            <img src="${currentUser.photoURL || 'logo.jpg'}" class="w-8 h-8 rounded-full">
            <div class="flex-1 truncate"><p class="text-xs font-bold">${currentUser.displayName || 'User'}</p></div>
        </div>
        <div id="profilePopup" class="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-100 rounded-2xl shadow-xl hidden p-2 z-[2000]">
            <button id="logoutBtn" class="w-full text-right p-3 text-xs font-bold hover:bg-gray-50 rounded-xl text-red-500" data-i18n="common.logout">Logout</button>
        </div>
    `;
    const trigger = getEl('profileTrigger');
    const popup = getEl('profilePopup');
    trigger.onclick = (e) => { e.stopPropagation(); popup.classList.toggle('hidden'); };
    getEl('logoutBtn').onclick = () => { dom.logoutConfirm.classList.remove('hidden'); dom.logoutConfirm.style.display = 'flex'; popup.classList.add('hidden'); };
    updateUIStrings();
}

// Mode Management
dom.mainAttachBtn.onclick = (e) => {
    e.stopPropagation();
    dom.modePopup.style.display = dom.modePopup.style.display === 'block' ? 'none' : 'block';
};

window.switchMode = (mode) => {
    currentMode = mode;
    dom.modePopup.style.display = 'none';
    
    if (mode === 'chat') {
        dom.settingsPanel.style.display = 'none';
        dom.attachIcon.className = 'fa-solid fa-plus text-lg';
    } else {
        dom.panelTitle.textContent = i18next.t(mode === 'image' ? 'generator.title_image' : 'generator.title_video');
        dom.videoOptions.classList.toggle('hidden', mode === 'image');
        dom.imageOptions.classList.toggle('hidden', mode === 'video');
        dom.attachIcon.className = mode === 'image' ? 'fa-solid fa-image text-blue-500' : 'fa-solid fa-video text-purple-500';
        
        const models = mode === 'image' ? imageModels : videoModels;
        dom.genModel.innerHTML = models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        dom.settingsPanel.style.display = 'block';
    }
};

window.hideSettings = () => {
    dom.settingsPanel.style.display = 'none';
};

// Selection Options
document.querySelectorAll('.size-opt').forEach(btn => {
    btn.onclick = () => {
        genSettings.size = btn.dataset.size;
        document.querySelectorAll('.size-opt').forEach(b => b.classList.toggle('active', b.dataset.size === genSettings.size));
    };
});

document.querySelectorAll('.count-opt').forEach(btn => {
    btn.onclick = () => {
        genSettings.count = parseInt(btn.dataset.count);
        document.querySelectorAll('.count-opt').forEach(b => b.classList.toggle('active', parseInt(b.dataset.count) === genSettings.count));
    };
});

document.querySelectorAll('.dur-opt').forEach(btn => {
    btn.onclick = () => {
        genSettings.duration = parseInt(btn.dataset.dur);
        document.querySelectorAll('.dur-opt').forEach(b => b.classList.toggle('active', parseInt(b.dataset.dur) === genSettings.duration));
    };
});

// Sending Logic
window.handleSend = async () => {
    const val = dom.chatInput.value.trim();
    if (!val || !currentUser) return;

    dom.emptyView.style.display = 'none';
    
    // Create the message with context if not in chat mode
    let displayMsg = val;
    let systemContext = "";
    let activeModel = "";

    if (currentMode === 'chat') {
        activeModel = chatModels[0].id; // Default chat model
    } else {
        activeModel = dom.genModel.value;
        systemContext = `\n[Mode: ${currentMode}, Model: ${activeModel}, Size: ${genSettings.size}, ${currentMode === 'image' ? 'Count: ' + genSettings.count : 'Duration: ' + genSettings.duration + 's'}]`;
    }

    appendMessage('user', displayMsg);
    dom.chatInput.value = '';
    const typing = appendTyping();

    try {
        const aiRes = i18next.t('chat.experimental_response', { model: activeModel });
        typing.remove();
        appendMessage('bot', aiRes);

        const chatData = {
            userId: currentUser.uid,
            title: val.substring(0, 30),
            messages: arrayUnion(
                { sender: 'user', text: val + systemContext, timestamp: new Date() },
                { sender: 'bot', text: aiRes, timestamp: new Date() }
            ),
            updatedAt: serverTimestamp()
        };

        if (!currentChatId) {
            const docRef = await addDoc(collection(db, 'chats'), chatData);
            currentChatId = docRef.id;
        } else {
            await updateDoc(doc(db, 'chats', currentChatId), {
                messages: arrayUnion(
                    { sender: 'user', text: val + systemContext, timestamp: new Date() },
                    { sender: 'bot', text: aiRes, timestamp: new Date() }
                ),
                updatedAt: serverTimestamp()
            });
        }
    } catch (e) { console.error(e); typing.remove(); }
};

dom.sendBtn.onclick = window.handleSend;
dom.chatInput.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.handleSend(); } };

function appendMessage(sender, text) {
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'flex justify-end' : 'flex justify-start';
    const isAr = i18next.language.startsWith('ar');
    div.innerHTML = `<div class="${sender === 'user' ? 'bg-gray-100' : 'bg-white border border-gray-50 shadow-sm'} px-5 py-3 rounded-2xl max-w-[85%] text-sm ${sender === 'user' ? (isAr ? 'rounded-tr-none' : 'rounded-tl-none') : (isAr ? 'rounded-tl-none' : 'rounded-tr-none')}">${text}</div>`;
    dom.messageBox.appendChild(div);
    dom.chatWindow.scrollTop = dom.chatWindow.scrollHeight;
}

function appendTyping() {
    const div = document.createElement('div');
    div.className = 'flex justify-start';
    div.innerHTML = `<div class="bg-white border border-gray-50 px-5 py-3 rounded-2xl shadow-sm text-xs italic text-gray-400">...</div>`;
    dom.messageBox.appendChild(div);
    dom.chatWindow.scrollTop = dom.chatWindow.scrollHeight;
    return div;
}

// History
function listenToHistory() {
    const q = query(collection(db, 'chats'), where('userId', '==', currentUser.uid), orderBy('updatedAt', 'desc'));
    unsubscribeHistory = onSnapshot(q, (snap) => {
        dom.recentList.innerHTML = '';
        snap.forEach(docSnap => {
            const item = document.createElement('div');
            item.className = `p-3 rounded-xl hover:bg-gray-100 cursor-pointer text-xs font-bold truncate ${currentChatId === docSnap.id ? 'bg-gray-100' : ''}`;
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
        docSnap.docs[0].data().messages.forEach(m => appendMessage(m.sender, m.text));
    }
}

// Sidebar & UI
dom.sidebarToggle.onclick = () => { dom.sidebar.classList.remove('-translate-x-full'); dom.overlay.classList.remove('hidden'); };
dom.overlay.onclick = () => { dom.sidebar.classList.add('-translate-x-full'); dom.overlay.classList.add('hidden'); };
dom.newChatBtn.onclick = () => { currentChatId = null; dom.messageBox.innerHTML = ''; dom.emptyView.style.display = 'flex'; };
dom.confirmYes.onclick = async () => { await signOut(auth); window.location.reload(); };
dom.confirmNo.onclick = () => { dom.logoutConfirm.classList.add('hidden'); dom.logoutConfirm.style.display = 'none'; };

window.onclick = (e) => {
    if (dom.modePopup && !dom.mainAttachBtn.contains(e.target)) dom.modePopup.style.display = 'none';
    if (getEl('profilePopup') && !getEl('profileTrigger').contains(e.target)) getEl('profilePopup').classList.add('hidden');
};
