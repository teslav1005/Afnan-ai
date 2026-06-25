import { auth, db } from './api.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy, deleteDoc, arrayUnion, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize i18next
i18next
  .use(i18nextHttpBackend)
  .use(i18nextBrowserLanguageDetector)
  .init({
    fallbackLng: 'ar',
    debug: false,
    backend: { loadPath: 'lang/{{lng}}.json' }
  }, function(err, t) {
    updateContent();
  });

function updateContent() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key.startsWith('[placeholder]')) {
            el.placeholder = i18next.t(key.replace('[placeholder]', ''));
        } else {
            el.innerHTML = i18next.t(key);
        }
    });
    const lang = i18next.language.startsWith('en') ? 'en' : 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.getElementById('langToggle').textContent = lang === 'ar' ? 'EN' : 'AR';
}

window.toggleLanguage = () => {
    const newLang = i18next.language.startsWith('ar') ? 'en' : 'ar';
    i18next.changeLanguage(newLang, () => {
        updateContent();
        renderChatModels();
    });
};

let currentUser = null;
let currentChatId = null;
let pendingAttachment = null;
let currentModel = 'mistral-small-3.2';
let currentMode = 'chat'; // chat, image, video
let unsubscribeHistory = null;

let genSettings = {
    model: 'nanobanana-2',
    size: '1:1',
    duration: 5,
    count: 1
};

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
    attachIcon: document.getElementById('attachIcon'),
    newChatBtn: document.getElementById('newChatBtn'),
    historyList: document.getElementById('historyList'),
    attachmentPreview: document.getElementById('attachmentPreview'),
    imageViewer: document.getElementById('imageViewer'),
    viewerImg: document.getElementById('viewerImg'),
    modelSelectorTop: document.getElementById('modelSelectorTop'),
    currentModelBtn: document.getElementById('currentModelBtn'),
    modelDropdown: document.getElementById('modelDropdown'),
    activeModelName: document.getElementById('activeModelName'),
    recentList: document.getElementById('recentList'),
    modeOptions: document.getElementById('modeOptions'),
    modeTitle: document.getElementById('modeTitle'),
    genModel: document.getElementById('genModel'),
    videoOptions: document.getElementById('videoOptions'),
    imageOptions: document.getElementById('imageOptions')
};

const chatModels = [
    { id: 'mistral-small-3.2', name: 'mistral-small-3.2' },
    { id: 'mercury', name: 'Mercury 2' },
    { id: 'midijourney', name: 'midijourney' },
    { id: 'openai-large', name: 'Gpt-5.5' },
    { id: 'gemini-large', name: 'Gemini-3.1Pro' },
    { id: 'claude-large', name: 'Claude Opus 4.8' },
    { id: 'deepseek-pro', name: 'deepseek-v4-Pro' }
];

const imageModels = [
    { id: 'nanobanana-2', name: 'nanobanana-2' },
    { id: 'gpt-image-2', name: 'gpt-image-2' },
    { id: 'nova-canvas', name: 'nova-canvas' }
];

const videoModels = [
    { id: 'ltx-2', name: 'Ltx2.3' },
    { id: 'seedance-pro', name: 'seedance-pro' },
    { id: 'veo', name: 'Veo3.1' }
];

onAuthStateChanged(auth, async (user) => {
    const loginBtnHeader = document.getElementById('loginBtnHeader');
    const profileSection = document.getElementById('profileSection');
    if (!user) {
        currentUser = null;
        if (loginBtnHeader) loginBtnHeader.style.display = 'block';
        dom.modelSelectorTop.classList.add('hidden');
        profileSection.innerHTML = '';
        dom.recentList.innerHTML = '';
        if (unsubscribeHistory) unsubscribeHistory();
    } else {
        currentUser = user;
        if (loginBtnHeader) loginBtnHeader.style.display = 'none';
        dom.modelSelectorTop.classList.remove('hidden');
        renderChatModels();
        profileSection.innerHTML = `
            <div id="profileTrigger" class="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer hover:bg-gray-200/50 transition-all">
                <img src="${user.photoURL || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full bg-black object-cover">
                <div class="flex-1 min-w-0 profile-text-align">
                    <p class="text-xs font-bold truncate">${user.displayName || 'User'}</p>
                    <p class="text-[10px] text-gray-500 truncate">${user.email || ''}</p>
                </div>
                <i class="fa-solid fa-ellipsis-vertical text-gray-300 text-xs"></i>
            </div>
            <div id="profilePopup" class="glass p-2 space-y-1 hidden absolute bottom-[70px] profile-popup-align w-[220px] z-[200] rounded-[1.5rem] shadow-xl">
                <a href="privacy.html" class="block p-3 text-sm hover:bg-gray-100 rounded-xl" data-i18n="common.privacy_policy"></a>
                <a href="terms.html" class="block p-3 text-sm hover:bg-gray-100 rounded-xl" data-i18n="common.terms_of_service"></a>
                <button id="logoutBtn" class="w-full profile-text-align p-3 text-sm hover:bg-gray-100 rounded-xl" data-i18n="common.logout"></button>
            </div>
        `;
        updateContent();
        setupProfileListeners();
        listenToChatHistory();
    }
});

const renderChatModels = () => {
    const list = document.getElementById('chatModelsList');
    if (!list) return;
    list.innerHTML = chatModels.map(m => `
        <div onclick="window.selectModel('${m.id}', '${m.name}')" class="p-3 hover:bg-white/50 rounded-xl cursor-pointer flex items-center justify-between transition-all">
            <span class="text-xs font-bold">${m.name}</span>
            ${currentModel === m.id ? '<i class="fa-solid fa-check text-black text-[10px]"></i>' : ''}
        </div>
    `).join('');
};

window.selectModel = (id, name) => {
    currentModel = id;
    dom.activeModelName.textContent = name;
    dom.modelDropdown.classList.add('hidden');
    renderChatModels();
    window.toast(i18next.t('common.toast_model_selected', { name }));
};

const setupProfileListeners = () => {
    const trigger = document.getElementById('profileTrigger');
    const popup = document.getElementById('profilePopup');
    if (trigger) trigger.onclick = (e) => { e.stopPropagation(); popup.classList.toggle('hidden'); };
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = () => {
        dom.logoutConfirm.classList.remove('hidden');
        dom.logoutConfirm.style.display = 'flex';
        popup.classList.add('hidden');
    };
};

dom.confirmYes.onclick = async () => { await signOut(auth); window.location.reload(); };
dom.confirmNo.onclick = () => { dom.logoutConfirm.classList.add('hidden'); dom.logoutConfirm.style.display = 'none'; };

window.switchMode = (mode) => {
    currentMode = mode;
    if (mode === 'chat') {
        dom.modeOptions.classList.remove('active');
        dom.attachIcon.className = 'fa-solid fa-plus text-lg';
        return;
    }
    
    dom.modeTitle.textContent = i18next.t(mode === 'image' ? 'generator.title_image' : 'generator.title_video');
    dom.videoOptions.classList.toggle('hidden', mode === 'image');
    dom.imageOptions.classList.toggle('hidden', mode === 'video');
    dom.attachIcon.className = mode === 'image' ? 'fa-solid fa-image text-blue-500' : 'fa-solid fa-video text-purple-500';
    
    const models = mode === 'image' ? imageModels : videoModels;
    dom.genModel.innerHTML = models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    genSettings.model = models[0].id;
    
    dom.modeOptions.classList.add('active');
};

window.setGenSize = (size) => {
    genSettings.size = size;
    document.querySelectorAll('.size-opt').forEach(btn => btn.classList.toggle('active', btn.dataset.size === size));
};

window.setGenDuration = (dur) => {
    genSettings.duration = dur;
    document.querySelectorAll('.dur-opt').forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.dur) === dur));
};

window.setGenCount = (count) => {
    genSettings.count = count;
    document.querySelectorAll('.count-opt').forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.count) === count));
};

window.handleSend = async () => {
    const val = dom.chatInput.value.trim();
    if (!val && !pendingAttachment) return;
    if (!currentUser) { window.navigateToPage('login.html'); return; }

    dom.emptyView.style.display = 'none';
    
    // Build context for generation if not in chat mode
    let modeContext = "";
    if (currentMode !== 'chat') {
        modeContext = `\n[Mode: ${currentMode}, Model: ${dom.genModel.value}, Size: ${genSettings.size}, ${currentMode === 'image' ? 'Count: ' + genSettings.count : 'Duration: ' + genSettings.duration + 's'}]`;
    }

    appendMessage('user', val, pendingAttachment);
    
    const currentText = val + modeContext;
    const currentAttach = pendingAttachment;
    const activeModel = currentMode === 'chat' ? currentModel : dom.genModel.value;
    
    dom.chatInput.value = '';
    pendingAttachment = null;
    dom.attachmentPreview.classList.add('hidden');

    const typing = document.createElement('div');
    typing.className = 'flex justify-start mb-4';
    typing.innerHTML = `<div class="bg-white border border-gray-100 px-5 py-3.5 rounded-[1.8rem] rounded-tl-md shadow-sm"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
    dom.messageBox.appendChild(typing);
    dom.chatWindow.scrollTop = dom.chatWindow.scrollHeight;

    try {
        const aiRes = i18next.t('chat.experimental_response', { model: activeModel });
        typing.remove();
        appendMessage('bot', aiRes);

        const msgUser = { sender: 'user', text: currentText, attachment: currentAttach, model: activeModel, timestamp: new Date() };
        const msgBot = { sender: 'bot', text: aiRes, timestamp: new Date() };

        if (!currentChatId) {
            const docRef = await addDoc(collection(db, 'chats'), {
                userId: currentUser.uid,
                title: val.substring(0, 30),
                messages: [msgUser, msgBot],
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

const appendMessage = (sender, text, attachment) => {
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'flex justify-end' : 'flex justify-start';
    let content = text;
    const isAr = i18next.language.startsWith('ar');
    if (sender === 'user') {
        div.innerHTML = `<div class="bg-[#F4F4F4] px-5 py-3.5 rounded-[1.8rem] ${isAr ? 'rounded-tr-md' : 'rounded-tl-md'} max-w-[80%] text-[14px]">${content}</div>`;
    } else {
        div.innerHTML = `<div class="bg-white border border-gray-100 px-5 py-3.5 rounded-[1.8rem] ${isAr ? 'rounded-tl-md' : 'rounded-tr-md'} max-w-[80%] text-[14px] shadow-sm">${content}</div>`;
    }
    dom.messageBox.appendChild(div);
    dom.chatWindow.scrollTop = dom.chatWindow.scrollHeight;
};

const listenToChatHistory = () => {
    const q = query(collection(db, 'chats'), where('userId', '==', currentUser.uid), orderBy('updatedAt', 'desc'));
    unsubscribeHistory = onSnapshot(q, (snap) => {
        dom.recentList.innerHTML = '';
        snap.forEach(docSnap => {
            const chat = docSnap.data();
            const id = docSnap.id;
            const item = document.createElement('div');
            item.className = `p-3 rounded-xl hover:bg-gray-100 cursor-pointer text-xs font-bold truncate ${currentChatId === id ? 'bg-gray-100' : ''}`;
            item.textContent = chat.title || i18next.t('common.new_chat');
            item.onclick = () => window.loadChat(id);
            dom.recentList.appendChild(item);
        });
    });
};

window.loadChat = async (id) => {
    currentChatId = id;
    dom.messageBox.innerHTML = '';
    dom.emptyView.style.display = 'none';
    const snap = await getDocs(query(collection(db, 'chats'), where('__name__', '==', id)));
    if (!snap.empty) {
        snap.docs[0].data().messages.forEach(msg => appendMessage(msg.sender, msg.text, msg.attachment));
    }
};

dom.mainAttachBtn.onclick = () => {
    if (currentMode === 'chat') window.switchMode('image');
    else window.switchMode('chat');
};

dom.newChatBtn.onclick = () => {
    currentChatId = null;
    dom.messageBox.innerHTML = '';
    dom.emptyView.style.display = 'flex';
    window.toast(i18next.t('common.toast_new_chat'));
};

dom.sendBtn.onclick = (e) => {
    e.preventDefault();
    window.handleSend();
};

dom.chatInput.onkeydown = (e) => { 
    if(e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        window.handleSend(); 
    } 
};

window.toast = (msg) => {
    const t = document.createElement('div');
    t.className = 'glass px-4 py-2 rounded-full text-xs fixed bottom-24 left-1/2 -translate-x-1/2 z-[5000] shadow-xl animate-pop';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
};

window.navigateToPage = (page) => window.location.href = page;
window.closeImageViewer = () => dom.imageViewer.classList.add('hidden');

document.getElementById('sidebarToggle').onclick = () => {
    dom.sidebar.classList.remove(i18next.language.startsWith('ar') ? '-translate-x-full' : 'translate-x-full');
    dom.overlay.classList.remove('hidden');
    dom.overlay.style.opacity = '1';
};

dom.overlay.onclick = () => {
    dom.sidebar.classList.add(i18next.language.startsWith('ar') ? '-translate-x-full' : 'translate-x-full');
    dom.overlay.classList.add('hidden');
    dom.overlay.style.opacity = '0';
};

dom.currentModelBtn.onclick = (e) => {
    e.stopPropagation();
    dom.modelDropdown.classList.toggle('hidden');
};

window.onclick = (e) => {
    if (dom.currentModelBtn && !dom.currentModelBtn.contains(e.target)) {
        dom.modelDropdown.classList.add('hidden');
    }
};
