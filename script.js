import { auth, db } from './api.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy, deleteDoc, arrayUnion, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// State
let currentUser = null;
let currentChatId = null;
let currentMode = 'chat';
let activeModelId = 'mistral-small-3.2';
let isThinking = false;
let genSettings = { size: '1:1', duration: 5, count: 1 };

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

const dom = {
    modelChips: document.getElementById('modelChips'),
    modeTrigger: document.getElementById('modeTrigger'),
    modeIcon: document.getElementById('modeIcon'),
    modePopover: document.getElementById('modePopover'),
    settingsBar: document.getElementById('settingsBar'),
    extraOptions: document.getElementById('extraOptions'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    messageBox: document.getElementById('messageBox'),
    emptyView: document.getElementById('emptyView'),
    chatWindow: document.getElementById('chatWindow'),
    thinkingToggle: document.getElementById('thinkingToggle'),
    profileTrigger: document.getElementById('profileTrigger'),
    profileMenu: document.getElementById('profileMenu'),
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('overlay'),
    recentList: document.getElementById('recentList'),
    langToggle: document.getElementById('langToggle')
};

// i18n
i18next
    .use(i18nextHttpBackend)
    .use(i18nextBrowserLanguageDetector)
    .init({
        fallbackLng: 'ar',
        backend: { loadPath: 'lang/{{lng}}.json' }
    }, () => { 
        updateUI(); 
        renderModelChips(); 
    });

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
    i18next.changeLanguage(i18next.language.startsWith('ar') ? 'en' : 'ar', updateUI);
};
dom.langToggle.onclick = window.toggleLanguage;

// Auth
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('loginBtnHeader').style.display = 'none';
        document.getElementById('profileName').textContent = user.displayName || 'User';
        document.getElementById('profileEmail').textContent = user.email || '';
        document.getElementById('userPhoto').src = user.photoURL || 'logo.jpg';
        listenToHistory();
    } else {
        document.getElementById('loginBtnHeader').style.display = 'block';
    }
});

// Mode & Models
function renderModelChips() {
    const models = modelsData[currentMode];
    dom.modelChips.innerHTML = models.map(m => `
        <button onclick="window.selectModel('${m.id}')" class="mode-btn ${activeModelId === m.id ? 'active' : ''}">${m.name}</button>
    `).join('');
}

window.selectModel = (id) => {
    activeModelId = id;
    renderModelChips();
};

window.switchMode = (mode) => {
    currentMode = mode;
    activeModelId = modelsData[mode][0].id;
    dom.modePopover.style.display = 'none';
    
    const isChat = mode === 'chat';
    dom.modeIcon.className = isChat ? 'fa-solid fa-plus text-xl' : (mode === 'image' ? 'fa-solid fa-sparkles text-blue-500' : 'fa-solid fa-film text-purple-500');
    dom.settingsBar.style.display = isChat ? 'none' : 'block';
    document.getElementById('quickOptions').style.display = isChat ? 'flex' : 'none';
    
    // Extra options for media
    if (!isChat) {
        const label = i18next.t(mode === 'image' ? 'generator.count_label' : 'generator.duration_label');
        const opts = mode === 'image' ? [1, 2, 4] : [5, 10, 20];
        const unit = mode === 'image' ? 'x' : 's';
        const key = mode === 'image' ? 'count' : 'duration';
        
        dom.extraOptions.innerHTML = `
            <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest mr-2">${label}</span>
            ${opts.map(o => `<button onclick="window.updateExtra('${key}', ${o})" class="size-chip ${genSettings[key] == o ? 'active' : ''}">${o}${unit}</button>`).join('')}
        `;
    }
    
    renderModelChips();
};

window.updateExtra = (key, val) => {
    genSettings[key] = val;
    window.switchMode(currentMode); // Re-render extra options
};

window.hideSettings = () => dom.settingsBar.style.display = 'none';

dom.modeTrigger.onclick = (e) => {
    e.stopPropagation();
    dom.modePopover.style.display = dom.modePopover.style.display === 'block' ? 'none' : 'block';
};

dom.thinkingToggle.onclick = () => {
    isThinking = !isThinking;
    dom.thinkingToggle.style.background = isThinking ? '#000' : '#f9fafb';
    dom.thinkingToggle.style.color = isThinking ? '#fff' : '#000';
};

// Global Click
window.onclick = () => {
    dom.modePopover.style.display = 'none';
    dom.profileMenu.style.display = 'none';
};

dom.profileTrigger.onclick = (e) => {
    e.stopPropagation();
    dom.profileMenu.style.display = dom.profileMenu.style.display === 'block' ? 'none' : 'block';
};

// Send Logic
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

        const chatData = {
            userId: currentUser.uid,
            title: val.substring(0, 30),
            messages: arrayUnion(
                { sender: 'user', text: val, timestamp: new Date() },
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
                    { sender: 'user', text: val, timestamp: new Date() },
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
                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">${currentMode.toUpperCase()} OUTPUT</span>
                <button class="bg-black text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Download</button>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="${sender === 'user' ? 'bg-gray-100' : 'bg-white border border-gray-100 shadow-sm'} px-6 py-4 rounded-[2rem] max-w-[85%] text-[15px] font-medium ${sender === 'user' ? (isAr ? 'rounded-tr-none' : 'rounded-tl-none') : (isAr ? 'rounded-tl-none' : 'rounded-tr-none')}">
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

// Sidebar
function listenToHistory() {
    const q = query(collection(db, 'chats'), where('userId', '==', currentUser.uid), orderBy('updatedAt', 'desc'));
    onSnapshot(q, (snap) => {
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

document.getElementById('sidebarToggle').onclick = () => { dom.sidebar.classList.remove('-translate-x-full'); dom.overlay.classList.remove('hidden'); };
dom.overlay.onclick = () => { dom.sidebar.classList.add('-translate-x-full'); dom.overlay.classList.add('hidden'); };
dom.newChatBtn.onclick = () => { currentChatId = null; dom.messageBox.innerHTML = ''; dom.emptyView.style.display = 'flex'; };
window.navigateTo = (url) => window.location.href = url;
