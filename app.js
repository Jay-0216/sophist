import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, addDoc, serverTimestamp, runTransaction, query, orderBy, limit } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";

console.log('Sophist App: Script Starting...');
// Elements
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyCheck = document.getElementById('save-api-key');
const modelSelect = document.getElementById('model-select');
const toneSelect = document.getElementById('tone-select');
const opponentInput = document.getElementById('opponent-input');
const mediaUpload = document.getElementById('media-upload');
const fileNameDisplay = document.getElementById('file-name');
const imagePreview = document.getElementById('image-preview');
const videoPreview = document.getElementById('video-preview');
const submitBtn = document.getElementById('submit-btn');
const submitBtnText = document.getElementById('submit-btn-text');
const spinner = document.getElementById('spinner');

// Auth & Sidebar Elements
const authHeaderBtn = document.getElementById('auth-header-btn');
const authModal = document.getElementById('auth-modal');
const closeAuthBtn = document.getElementById('close-auth-btn');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authTitle = document.getElementById('auth-title');

const historySidebar = document.getElementById('history-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const historyList = document.getElementById('history-list');
const logoutBtn = document.getElementById('logout-btn');
const saveHistoryBtn = document.getElementById('save-history-btn');

const errorMsg = document.getElementById('error-message');
const outputPanel = document.getElementById('output-panel');
const aiResponse = document.getElementById('ai-response');
const copyBtn = document.getElementById('copy-btn');
const sttBtn = document.getElementById('stt-btn');
const ttsBtn = document.getElementById('tts-btn');
const keepHistoryCheck = document.getElementById('keep-history');
const clearHistoryBtn = document.getElementById('clear-history');

// --- Layout Control Sections ---
const settingsPanel = document.querySelector('.settings-panel');
const inputPanel = document.querySelector('.input-panel');
const convControls = document.querySelector('.conversation-mode-controls');

// --- Theme Elements ---
const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

// --- Continuation Elements ---
const continuationArea = document.getElementById('continuation-area');
const followUpInput = document.getElementById('follow-up-input');
const submitBtnFollow = document.getElementById('submit-btn-follow');
const stopBtnFollow = document.getElementById('stop-btn-follow');
const resetBtnFollow = document.getElementById('reset-btn-follow');
const sttBtnFollow = document.getElementById('stt-btn-follow');

// --- Mode Toggle Elements ---
const modeToggle = document.getElementById('sophist-mode-toggle');
const labelCriticize = document.getElementById('label-criticize');
const labelSupport = document.getElementById('label-support');
const mainPanelTitle = document.getElementById('main-panel-title');
const outputPanelTitle = document.getElementById('output-panel-title');
const followUpTitle = document.getElementById('follow-up-title');

// --- Gemini Live UI Elements ---
const convModeBtn = document.getElementById('conv-mode-btn');
const liveOverlay = document.getElementById('live-overlay');
const convStopBtnLive = document.getElementById('conv-stop-btn-live');
const toggleWebcamBtn = document.getElementById('toggle-webcam-btn');
const liveStatusText = document.getElementById('live-status-text');
const liveUserTranscript = document.getElementById('live-user-transcript');
const liveAiResponse = document.getElementById('live-ai-response');
const webcamPreview = document.getElementById('webcam-preview');
const webcamCanvas = document.getElementById('webcam-canvas');

const liveModelModal = document.getElementById('live-model-modal');
const liveModelSelect = document.getElementById('live-model-select');
const liveModelConfirmBtn = document.getElementById('live-model-confirm-btn');
const liveModelCancelBtn = document.getElementById('live-model-cancel-btn');
const liveModelCloseBtn = document.getElementById('live-model-close-btn');

// State
let currentFile = null;
let currentBase64 = null;
let currentMimeType = null;
let conversationHistory = [];
let themeClickCount = 0; // Easter egg counter
let isEasterEggActive = false;
let easterEggInterval = null;

// Conversation Mode State
let isConversationMode = false;
let isSpeaking = false;
let isWebcamOn = false; // 기본 카메라 끄기
let mediaStream = null;
let activeUtterance = null;
let sttTimer = null;
let lastTranscript = "";
let isRequesting = false;
const SPEECH_RECOGNITION_SENSITIVITY = 1000; // 1초 침묵 시 자동 종료
let currentAbortController = null; // For stopping generation
let currentAiSpeechText = ""; // To prevent echo self-interruption



// --- API Key Security Logic ---
const STORAGE_KEY = 'sophist_encrypted_api_key';
const ENCRYPTION_SECRET = 'sophist_logic_shield_2026';

function simpleEncrypt(text) {
  const code = text.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ ENCRYPTION_SECRET.charCodeAt(i % ENCRYPTION_SECRET.length))
  ).join('');
  return btoa(unescape(encodeURIComponent(code)));
}

function simpleDecrypt(encoded) {
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    return decoded.split('').map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ ENCRYPTION_SECRET.charCodeAt(i % ENCRYPTION_SECRET.length))
    ).join('');
  } catch (e) { return ""; }
}

// Firebase configuration from USER
const firebaseConfig = {
  apiKey: "AIzaSyD50eEVzAZkawrSO31JRhTRJNugvRQVfLo",
  authDomain: "sophist-c1b46.firebaseapp.com",
  projectId: "sophist-c1b46",
  storageBucket: "sophist-c1b46.firebasestorage.app",
  messagingSenderId: "415584180941",
  appId: "1:415584180941:web:291857a1baf7001139a784",
  measurementId: "G-1E26NKST42"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let aiClient = null;
let aiClientApiKey = null;
function getAiClient(apiKey) {
  if (!apiKey) return null;
  if (aiClient && aiClientApiKey === apiKey) return aiClient;
  aiClientApiKey = apiKey;
  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

let currentUser = null;
let isRegisterMode = false;
let currentLoadedHistoryId = null;
let initialAuthChecked = false;

onAuthStateChanged(auth, async (user) => {
  const wasLoggedIn = !!currentUser;
  currentUser = user;

  if (user) {
    authHeaderBtn.textContent = '마이페이지';
    authModal.classList.add('hidden');
    saveHistoryBtn.classList.remove('hidden');
    document.getElementById('sidebar-email').textContent = user.email;
    document.getElementById('user-profile-sidebar').classList.remove('hidden');
    await loadUserData(user.uid);
    loadHistories();
  } else {
    authHeaderBtn.textContent = '로그인';
    saveHistoryBtn.classList.add('hidden');
    document.getElementById('sidebar-nickname').textContent = '게스트';
    document.getElementById('sidebar-email').textContent = '로그인이 필요합니다';
    document.getElementById('user-profile-sidebar').classList.add('hidden');

    // Only clear if this was a literal logout action, 
    // NOT on initial load when user is just a guest.
    if (wasLoggedIn) {
      apiKeyInput.value = '';
      saveApiKeyCheck.checked = false;
      localStorage.removeItem(STORAGE_KEY);
      currentLoadedHistoryId = null;
      historyList.innerHTML = '<p class="empty-state">저장된 기록이 없습니다.</p>';
    } else if (!initialAuthChecked) {
      // First time check and no user? Load from localStorage as fallback
      const savedEncryptedKey = localStorage.getItem(STORAGE_KEY);
      if (savedEncryptedKey) {
        apiKeyInput.value = simpleDecrypt(savedEncryptedKey);
        saveApiKeyCheck.checked = true;
      }
    }
  }
  initialAuthChecked = true;
});

async function loadUserData(uid) {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.encryptedApiKey) {
        apiKeyInput.value = simpleDecrypt(data.encryptedApiKey);
        saveApiKeyCheck.checked = true;
      }
      if (data.model) modelSelect.value = data.model;
      if (data.tone) toneSelect.value = data.tone;
      syncAllCustomDropdowns();
      if (data.nickname) {
        document.getElementById('sidebar-nickname').textContent = data.nickname;
      } else {
        document.getElementById('sidebar-nickname').textContent = '사용자';
      }
    }
  } catch (e) { console.error("Error loading user data:", e); }
}

async function saveUserData(uid) {
  if (!uid) return;
  const dataToSave = {
    model: modelSelect.value,
    tone: toneSelect.value
  };
  if (saveApiKeyCheck.checked && apiKeyInput.value) {
    dataToSave.encryptedApiKey = simpleEncrypt(apiKeyInput.value);
  } else {
    dataToSave.encryptedApiKey = "";
  }

  try {
    await setDoc(doc(db, "users", uid), dataToSave, { merge: true });
  } catch (e) { console.error("Error saving user data:", e); }
}

document.addEventListener('DOMContentLoaded', () => {
  const savedEncryptedKey = localStorage.getItem(STORAGE_KEY);
  if (savedEncryptedKey) {
    apiKeyInput.value = simpleDecrypt(savedEncryptedKey);
    saveApiKeyCheck.checked = true;
  }

  // Theme check
  if (localStorage.getItem('sophist_theme') === 'light') {
    document.body.classList.add('light-mode');
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  }

  // Pre-load voices for faster TTS initialization
  window.speechSynthesis.getVoices();

  // Initial Permission Request for Mic and Camera
  // Only runs if not already granted to avoid annoying users on every refresh (though browsers handle this)
  requestInitialPermissions();
});

async function requestInitialPermissions() {
  try {
    // This triggers the browser's permission prompt for both at once
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    // Immediately stop the tracks as we only wanted the permission, not the active stream yet
    stream.getTracks().forEach(track => track.stop());
    console.log("초기 권한 획득 성공");
  } catch (err) {
    console.warn("일부 권한이 거부되었거나 장치를 찾을 수 없습니다.", err);
  }
}

// Debounce helper
let apiKeySaveTimer = null;
function debouncedSaveApiKey() {
  clearTimeout(apiKeySaveTimer);
  apiKeySaveTimer = setTimeout(() => {
    if (saveApiKeyCheck.checked) {
      if (currentUser) saveUserData(currentUser.uid);
      else if (apiKeyInput.value) localStorage.setItem(STORAGE_KEY, simpleEncrypt(apiKeyInput.value));
    }
  }, 800); // 0.8초 후 자동 저장
}

apiKeyInput.addEventListener('input', debouncedSaveApiKey);

saveApiKeyCheck.addEventListener('change', () => {
  if (saveApiKeyCheck.checked) {
    // Save immediately when user turns on the checkbox
    if (currentUser) saveUserData(currentUser.uid);
    else if (apiKeyInput.value) localStorage.setItem(STORAGE_KEY, simpleEncrypt(apiKeyInput.value));
  } else {
    // Clear when turned off
    if (currentUser) saveUserData(currentUser.uid); // saves empty key
    else localStorage.removeItem(STORAGE_KEY);
  }
});

// --- Gemini Model Selection ---
const GEMINI_MODELS = [
  { value: 'gemini-flash-latest', text: 'Gemini Flash Latest' },
  { value: 'gemini-flash-lite-latest', text: 'Gemini Flash-Lite Latest' },
  { value: 'gemini-pro-latest', text: 'Gemini Pro Latest' },
  { value: 'gemini-2.5-flash', text: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', text: 'Gemini 2.5 Pro' },
  { value: 'gemini-3-pro-preview', text: 'Gemini 3 Pro Preview' },
  { value: 'gemini-3-flash-preview', text: 'Gemini 3 Flash Preview' },
  { value: 'gemini-3.1-pro-preview', text: 'Gemini 3.1 Pro Preview' },
  { value: 'gemini-3.1-flash-lite-preview', text: 'Gemini 3.1 Flash Lite Preview' }
];
const NORMAL_GEMINI_MODELS = GEMINI_MODELS.filter(m => !/tts/i.test(m.value));
const LIVE_GEMINI_MODELS = NORMAL_GEMINI_MODELS;
let currentModelMode = 'normal';

function updateModelOptions(mode = 'normal') {
  currentModelMode = mode;
  const models = mode === 'live' ? LIVE_GEMINI_MODELS : NORMAL_GEMINI_MODELS;
  const allowedModels = models.length > 0 ? models : NORMAL_GEMINI_MODELS;

  if (modelSelect) {
    modelSelect.innerHTML = allowedModels.map(m => `<option value="${m.value}">${m.text}</option>`).join('');
  }

  const customOptions = document.querySelector('#custom-model-select .custom-options');
  const customTrigger = document.querySelector('#custom-model-select .custom-select-trigger span');
  if (customOptions) {
    customOptions.innerHTML = allowedModels.map(m =>
      `<span class="custom-option" data-value="${m.value}">${m.text}</span>`
    ).join('');

    customOptions.querySelectorAll('.custom-option').forEach(option => {
      option.addEventListener('click', () => {
        const value = option.getAttribute('data-value');
        if (modelSelect) modelSelect.value = value;
        if (currentUser) saveUserData(currentUser.uid);

        customOptions.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        if (customTrigger) customTrigger.textContent = option.textContent;
        const customModelContainer = document.getElementById('custom-model-select');
        if (customModelContainer) customModelContainer.classList.remove('open');
      });
    });
  }

  if (customTrigger && allowedModels.length > 0) {
    customTrigger.textContent = allowedModels[0].text;
  }

  if (currentUser) saveUserData(currentUser.uid);
}

if (modelSelect) modelSelect.addEventListener('change', () => { if (currentUser) saveUserData(currentUser.uid); });
if (toneSelect) toneSelect.addEventListener('change', () => { if (currentUser) saveUserData(currentUser.uid); });

updateModelOptions();

// --- Custom Select handlers ---
try {
  const customModelSelect = document.getElementById('custom-model-select');

  const initCustomDropdown = (container, selectId, onSelect) => {
    if (!container) return;
    const trigger = container.querySelector('.custom-select-trigger');
    const options = container.querySelector('.custom-options');
    const hiddenSelect = document.getElementById(selectId);
    if (!trigger || !options || !hiddenSelect) return;

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      container.classList.toggle('open');
    });

    options.querySelectorAll('.custom-option').forEach(option => {
      option.addEventListener('click', () => {
        const value = option.getAttribute('data-value');
        hiddenSelect.value = value;
        if (onSelect) onSelect(value, option);

        options.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        const span = trigger.querySelector('span');
        if (span) span.textContent = option.textContent;

        container.classList.remove('open');
        hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  };

  const syncCustomDropdown = (containerId, selectId) => {
    const container = document.getElementById(containerId);
    const hiddenSelect = document.getElementById(selectId);
    if (!container || !hiddenSelect) return;
    const triggerSpan = container.querySelector('.custom-select-trigger span');
    const selectedOption = Array.from(container.querySelectorAll('.custom-option'))
      .find(opt => opt.getAttribute('data-value') === hiddenSelect.value);
    if (selectedOption && triggerSpan) triggerSpan.textContent = selectedOption.textContent;
  };

  window.syncAllCustomDropdowns = () => {
    syncCustomDropdown('custom-tone-select', 'tone-select');
    syncCustomDropdown('custom-model-select', 'model-select');
  };

  const customToneSelect = document.getElementById('custom-tone-select');

  initCustomDropdown(customModelSelect, 'model-select', (value) => {
    if (modelSelect) modelSelect.value = value;
    if (currentUser) saveUserData(currentUser.uid);
  });

  initCustomDropdown(customToneSelect, 'tone-select', (value) => {
    if (toneSelect) toneSelect.value = value;
    if (currentUser) saveUserData(currentUser.uid);
  });

  // 초기 동기화
  syncAllCustomDropdowns();

  document.addEventListener('click', () => {
    [customModelSelect, customToneSelect].forEach(container => {
      if (container) container.classList.remove('open');
    });
  });
} catch (e) {
  console.log('Custom select initialization failed:', e.message);
}

// --- Auth UI Logic ---
authHeaderBtn.addEventListener('click', () => {
  if (currentUser) {
    historySidebar.classList.remove('hidden');
    sidebarOverlay.classList.remove('hidden');
  } else {
    authModal.classList.remove('hidden');
  }
});

closeAuthBtn.addEventListener('click', () => authModal.classList.add('hidden'));

const nicknameGroup = document.getElementById('nickname-group');
const authNicknameInput = document.getElementById('auth-nickname');

function handleAuthToggle(e) {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;
  authTitle.textContent = isRegisterMode ? '회원가입' : '로그인';
  authSubmitBtn.textContent = isRegisterMode ? '회원가입' : '로그인';
  authError.classList.add('hidden');

  if (isRegisterMode) {
    nicknameGroup.classList.remove('hidden');
    authNicknameInput.required = true;
  } else {
    nicknameGroup.classList.add('hidden');
    authNicknameInput.required = false;
  }

  document.getElementById('auth-toggle-text').innerHTML = isRegisterMode ?
    '이미 계정이 있으신가요? <a href="#" id="auth-toggle-btn">로그인</a>' :
    '계정이 없으신가요? <a href="#" id="auth-toggle-btn">회원가입</a>';

  // Rebind toggler
  document.getElementById('auth-toggle-btn').addEventListener('click', handleAuthToggle);
}

authToggleBtn.addEventListener('click', handleAuthToggle);

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  const email = authEmail.value.trim();
  const password = authPassword.value;

  authSubmitBtn.disabled = true;
  try {
    if (isRegisterMode) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Save nickname to user doc
      await setDoc(doc(db, "users", userCredential.user.uid), {
        nickname: authNicknameInput.value.trim() || '익명논쟁가',
      }, { merge: true });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    // Form succeeds, onAuthStateChanged takes over
    authForm.reset();
  } catch (error) {
    authError.textContent = "오류: " + error.message;
    authError.classList.remove('hidden');
  } finally {
    authSubmitBtn.disabled = false;
  }
});

closeSidebarBtn.addEventListener('click', () => {
  historySidebar.classList.add('hidden');
  sidebarOverlay.classList.add('hidden');
});

sidebarOverlay.addEventListener('click', () => {
  historySidebar.classList.add('hidden');
  sidebarOverlay.classList.add('hidden');
});

logoutBtn.addEventListener('click', () => {
  signOut(auth);
  historySidebar.classList.add('hidden');
  sidebarOverlay.classList.add('hidden');
});

// --- History Logic ---

async function loadHistories() {
  if (!currentUser) return;
  try {
    const historyCol = collection(db, "users", currentUser.uid, "histories");
    const qSnapshot = await getDocs(historyCol);
    historyList.innerHTML = '';

    if (qSnapshot.empty) {
      historyList.innerHTML = '<p class="empty-state">저장된 기록이 없습니다.</p>';
      return;
    }

    // Convert to array and sort by date desc
    const histories = qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    histories.sort((a, b) => b.savedAt?.toMillis() - a.savedAt?.toMillis() || 0);

    histories.forEach(hist => {
      const div = document.createElement('div');
      div.className = 'history-item';

      const dateStr = hist.savedAt ? new Date(hist.savedAt.toDate()).toLocaleString() : '최근';
      const titleStr = hist.title || '이름 없는 대화';

      div.innerHTML = `
        <div class="history-date">${dateStr}</div>
        <div class="history-title">${titleStr}</div>
      `;

      div.addEventListener('click', () => resumeHistory(hist));
      historyList.appendChild(div);
    });

  } catch (e) {
    console.error("Error loading histories", e);
  }
}

async function resumeHistory(hist) {
  if (!hist || !hist.messages) return;
  currentLoadedHistoryId = hist.id;
  conversationHistory = hist.messages;

  // Close sidebar
  historySidebar.classList.add('hidden');
  sidebarOverlay.classList.add('hidden');

  // Render full history
  let fullHtml = '';
  // Usually history starts with USER -> AI -> USER -> AI
  let index = 0;
  while (index < conversationHistory.length) {
    const userMsg = conversationHistory[index];
    const aiMsg = conversationHistory[index + 1];

    if (userMsg && userMsg.role === 'user') {
      fullHtml += `**나:** ${userMsg.parts[0].text}\n\n`;
    }
    if (aiMsg && aiMsg.role === 'model') {
      fullHtml += `**Sophist:** ${aiMsg.parts[0].text}\n\n`;
      fullHtml += `<hr>`;
    }
    index += 2;
  }

  aiResponse.innerHTML = marked.parse(fullHtml);

  // Update UI to show Continuation mode
  settingsPanel.classList.add('hidden');
  inputPanel.classList.add('hidden');
  convControls.classList.add('hidden');

  outputPanel.classList.remove('hidden');
  continuationArea.classList.remove('hidden');

  saveHistoryBtn.innerText = '현재 상태 클라우드에 업데이트';
  saveHistoryBtn.disabled = false;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

saveHistoryBtn.addEventListener('click', async () => {
  if (!currentUser) {
    alert("로그인이 필요합니다.");
    return;
  }
  if (conversationHistory.length < 2) return;

  saveHistoryBtn.innerText = '저장 중...';
  saveHistoryBtn.disabled = true;

  try {
    const title = conversationHistory[0].parts[0].text.substring(0, 30) + "...";

    if (currentLoadedHistoryId) {
      // Update existing
      const docRef = doc(db, "users", currentUser.uid, "histories", currentLoadedHistoryId);
      await setDoc(docRef, { messages: conversationHistory, savedAt: serverTimestamp(), title }, { merge: true });
    } else {
      // Create new
      const colRef = collection(db, "users", currentUser.uid, "histories");
      const newDoc = await addDoc(colRef, { messages: conversationHistory, savedAt: serverTimestamp(), title });
      currentLoadedHistoryId = newDoc.id;
    }

    saveHistoryBtn.innerText = '저장 완료!';
    setTimeout(() => saveHistoryBtn.innerText = '현재 상태 클라우드에 업데이트', 2000);

    // Refresh sidebar silently
    loadHistories();

  } catch (e) {
    console.error("Error saving history:", e);
    alert("저장에 실패했습니다.");
    saveHistoryBtn.innerText = '클라우드에 저장 (이어서 반박 가능)';
    saveHistoryBtn.disabled = false;
  }
});

// --- Theme Toggle ---
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('sophist_theme', isLight ? 'light' : 'dark');
    if (sunIcon) sunIcon.classList.toggle('hidden');
    if (moonIcon) moonIcon.classList.toggle('hidden');

    // Easter Egg Logic
    themeClickCount++;
    if (themeClickCount === 20) {
      triggerEasterEgg();
      themeClickCount = 0;
    }
  });
}

function triggerEasterEgg() {
  const h1 = document.querySelector('.header h1');
  const originalText = "Sophist";
  const orbs = document.querySelectorAll('.orb');

  if (!isEasterEggActive) {
    // Turn ON
    isEasterEggActive = true;
    h1.textContent = "REALITY WARP";
    document.documentElement.style.transition = "filter 0.1s";

    const rainbowColors = [
      ['#ff0080', '#ff00ff', '#8000ff'],
      ['#ff6600', '#ff0000', '#ff00aa'],
      ['#00ff80', '#00ffff', '#0080ff'],
      ['#ffff00', '#ff8800', '#ff0000'],
      ['#aa00ff', '#0000ff', '#00aaff'],
    ];
    let i = 0;
    easterEggInterval = setInterval(() => {
      const palette = rainbowColors[i % rainbowColors.length];
      orbs[0] && (orbs[0].style.background = palette[0]);
      orbs[1] && (orbs[1].style.background = palette[1]);
      orbs[2] && (orbs[2].style.background = palette[2]);
      document.documentElement.style.filter = `hue-rotate(${i * 60}deg) saturate(2) brightness(1.05)`;
      h1.style.transform = `scale(${1 + Math.random() * 0.12}) rotate(${Math.random() * 6 - 3}deg)`;
      h1.style.textShadow = `0 0 20px ${palette[0]}, 0 0 40px ${palette[1]}`;
      i++;
    }, 120);
    alert("Sophist: 현실 왜곡 모드가 활성화되었습니다. 진실이 뒤섞입니다.");
  } else {
    // Turn OFF
    isEasterEggActive = false;
    clearInterval(easterEggInterval);
    document.documentElement.style.filter = "none";
    document.documentElement.style.transition = "";
    document.body.style.filter = "none";
    orbs.forEach(o => o.style.background = '');
    h1.textContent = originalText;
    h1.style.transform = "none";
    h1.style.textShadow = "none";
    alert("Sophist: 현실이 복구되었습니다. 다시 차가운 논리의 세계로 돌아갑니다.");
  }
}

// --- Mode Toggle Logic ---
if (modeToggle) {
  modeToggle.addEventListener('change', () => {
    const isSupport = modeToggle.checked;
    if (isSupport) {
      labelSupport.classList.add('active');
      labelCriticize.classList.remove('active');
      mainPanelTitle.textContent = "내 논리 강화";
      outputPanelTitle.textContent = "Sophist의 대리 논리";
      opponentInput.placeholder = "내 주장의 핵심 키워드나 문장을 입력하세요. Sophist가 당신의 입이 되어 완벽한 논리를 펼쳐줍니다...";
      submitBtnText.textContent = "내 논리 강화 생성";
      // ALWAYS keep "상대의 재반박" as requested
      if (followUpTitle) followUpTitle.textContent = "상대의 재반박";
    } else {
      labelCriticize.classList.add('active');
      labelSupport.classList.remove('active');
      mainPanelTitle.textContent = "상대의 논리";
      outputPanelTitle.textContent = "Sophist의 반박";
      if (followUpTitle) followUpTitle.textContent = "상대의 재반박";
      opponentInput.placeholder = "상대방이 뭐라고 했나요? 음성 인식을 쓰거나 직접 입력하세요...";
      submitBtnText.textContent = "반박 논리 생성하기";
    }
  });
}

// --- WebRTC Camera Logic ---
async function startWebcam() {
  if (!isWebcamOn) {
    webcamPreview.parentElement.classList.add('hidden');
    return true;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcamPreview.srcObject = mediaStream;
    webcamPreview.parentElement.classList.remove('hidden');
    return true;
  } catch (err) {
    console.error("웹캠 접근 실패", err);
    return false;
  }
}

function stopWebcam() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
}

toggleWebcamBtn.addEventListener('click', () => {
  isWebcamOn = !isWebcamOn;
  if (isWebcamOn) {
    startWebcam();
    toggleWebcamBtn.innerText = "카메라 끄기";
  } else {
    stopWebcam();
    webcamPreview.parentElement.classList.add('hidden');
    toggleWebcamBtn.innerText = "카메라 켜기";
  }
});
// 초기 상태 반영
if (!isWebcamOn) toggleWebcamBtn.innerText = "카메라 켜기";

function captureWebcamFrame() {
  if (!isWebcamOn || !mediaStream) return null;
  if (webcamPreview.videoWidth === 0) return null;
  webcamCanvas.width = webcamPreview.videoWidth;
  webcamCanvas.height = webcamPreview.videoHeight;
  const ctx = webcamCanvas.getContext('2d');
  ctx.drawImage(webcamPreview, 0, 0, webcamCanvas.width, webcamCanvas.height);
  return webcamCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

// --- Speech Recognition ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let activeSTTTarget = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'ko-KR';
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onstart = () => {
    if (isConversationMode) {
      liveStatusText.innerText = "Sophist가 듣고 있습니다...";
      liveStatusText.style.color = "var(--text-secondary)";
    } else {
      if (activeSTTTarget === opponentInput) sttBtn.classList.add('recording');
      else if (sttBtnFollow && activeSTTTarget === followUpInput) sttBtnFollow.classList.add('recording');
    }
  };

  recognition.onresult = (event) => {
    // Determine the current interim vs final results
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    // We only care about the latest segment for live updates
    const text = finalTranscript || interimTranscript;

    if (isConversationMode) {
      // Echo cancellation heuristic:
      // If AI is speaking, check if the recognized text is part of AI's current speech
      if (isSpeaking && text.trim().length > 0) {
        const cleanText = text.trim().replace(/[.,!?:;]/g, "");
        const cleanAi = currentAiSpeechText.replace(/[.,!?:;]/g, "");
        if (cleanAi.includes(cleanText) || cleanText.length < 2) {
          // Likely echo or too short, ignore
          return;
        }

        // If we reach here, it's likely a real user interruption
        window.speechSynthesis.cancel();
        isSpeaking = false;
        isRequesting = false;
      }

      lastTranscript = text;
      liveUserTranscript.innerText = text;

      clearTimeout(sttTimer);
      sttTimer = setTimeout(() => {
        if (isConversationMode && lastTranscript.trim() && !isRequesting) {
          processConversationInput(lastTranscript);
          // Clear the STT results accumulation by stopping and restarting
          try { recognition.stop(); } catch (e) { }
        }
      }, SPEECH_RECOGNITION_SENSITIVITY);
    } else if (activeSTTTarget) {
      // For non-live mode, just dump the whole text
      const fullText = Array.from(event.results).map(r => r[0].transcript).join('');
      activeSTTTarget.value = fullText;
    }
  };

  recognition.onend = () => {
    sttBtn.classList.remove('recording');
    if (sttBtnFollow) sttBtnFollow.classList.remove('recording');
    // Important: Only restart in Conversation Mode if user isn't currently speaking
    if (isConversationMode && !isSpeaking) {
      try {
        // Small delay to prevent "double-start" errors which trigger permission prompts in some browsers
        setTimeout(() => {
          if (isConversationMode) recognition.start();
        }, 100);
      } catch (e) { }
    }
  };
}

function handleSTT(target) {
  if (!recognition) return;
  if (sttBtn.classList.contains('recording') || (sttBtnFollow && sttBtnFollow.classList.contains('recording'))) {
    recognition.stop();
  } else {
    activeSTTTarget = target;
    recognition.start();
  }
}

sttBtn.addEventListener('click', () => handleSTT(opponentInput));
if (sttBtnFollow) sttBtnFollow.addEventListener('click', () => handleSTT(followUpInput));

// Enter 처리: Enter 치면 STT 종료, 음성 중단 및 즉시 생성
function handleEnterKey(e, mode) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (recognition) {
      recognition.stop();
    }
    window.speechSynthesis.cancel();
    callGemini(mode);
  }
}

opponentInput.addEventListener('keydown', (e) => handleEnterKey(e, 'primary'));
if (followUpInput) {
  followUpInput.addEventListener('keydown', (e) => handleEnterKey(e, 'followup'));
}

// --- AI Voice (Google 한국어 Neural 우선) ---
function speakText(textToRead) {
  window.speechSynthesis.cancel();
  currentAiSpeechText = textToRead;

  // Use global activeUtterance to prevent garbage collection halting the speech in Chrome
  activeUtterance = new SpeechSynthesisUtterance(textToRead);
  activeUtterance.lang = 'ko-KR';
  activeUtterance.rate = 1.05;
  activeUtterance.pitch = 1.0;

  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('ko')) ||
      voices.find(v => v.lang.includes('ko'));
    if (preferredVoice) activeUtterance.voice = preferredVoice;

    activeUtterance.onstart = () => {
      isSpeaking = true;
      if (ttsBtn) ttsBtn.classList.add('tts-speaking');
      if (stopBtnFollow) stopBtnFollow.classList.remove('hidden');
      if (isConversationMode) {
        liveStatusText.innerText = "Sophist가 이야기 중...";
        liveStatusText.style.color = "var(--accent)";
      }
    };

    activeUtterance.onend = () => {
      isSpeaking = false;
      if (ttsBtn) ttsBtn.classList.remove('tts-speaking');
      if (stopBtnFollow) stopBtnFollow.classList.add('hidden');
      if (isConversationMode) {
        lastTranscript = "";
        liveUserTranscript.innerText = "";
        liveStatusText.innerText = "Sophist가 듣고 있습니다...";
        liveStatusText.style.color = "var(--text-secondary)";
      }
    };
    window.speechSynthesis.speak(activeUtterance);
  };

  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = setVoice;
  } else {
    setVoice();
  }
}

// --- Live Mode Control ---
async function startConversationMode() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) { showError("API 키가 필요합니다."); return; }
  openLiveModelPopup();
}

function openLiveModelPopup() {
  if (!liveModelModal || !liveModelSelect) return;
  if (!LIVE_GEMINI_MODELS.length) {
    showError("LIVE 전용 Gemini 모델이 설정되지 않았습니다.");
    return;
  }

  const customLiveModelSelect = document.getElementById('custom-live-model-select');
  const customOptions = customLiveModelSelect?.querySelector('.custom-options');
  const customTrigger = customLiveModelSelect?.querySelector('.custom-select-trigger span');

  liveModelSelect.innerHTML = LIVE_GEMINI_MODELS.map(m =>
    `<option value="${m.value}">${m.text}</option>`
  ).join('');

  if (customOptions) {
    customOptions.innerHTML = LIVE_GEMINI_MODELS.map(m =>
      `<span class="custom-option" data-value="${m.value}">${m.text}</span>`
    ).join('');

    customOptions.querySelectorAll('.custom-option').forEach(option => {
      option.addEventListener('click', () => {
        const value = option.getAttribute('data-value');
        liveModelSelect.value = value;
        customOptions.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        if (customTrigger) customTrigger.textContent = option.textContent;
        customLiveModelSelect.classList.remove('open');
      });
    });
  }

  const currentLiveValue = LIVE_GEMINI_MODELS.find(m => m.value === modelSelect.value)?.value;
  const defaultValue = currentLiveValue || LIVE_GEMINI_MODELS[0].value;
  liveModelSelect.value = defaultValue;

  if (customTrigger && customOptions) {
    const defaultOption = customOptions.querySelector(`[data-value="${defaultValue}"]`);
    if (defaultOption) {
      customTrigger.textContent = defaultOption.textContent;
      customOptions.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
      defaultOption.classList.add('selected');
    }
  }

  // Initialize trigger click handler
  if (customLiveModelSelect) {
    const trigger = customLiveModelSelect.querySelector('.custom-select-trigger');
    if (trigger) {
      trigger.onclick = null; // Clear previous handlers
      trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        customLiveModelSelect.classList.toggle('open');
      });
    }
  }

  liveModelModal.classList.remove('hidden');
}

async function startLiveMode() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) { showError("API 키가 필요합니다."); return; }
  isConversationMode = true;
  lastTranscript = "";
  liveOverlay.classList.remove('hidden');
  await startWebcam();
  if (recognition) {
    try { recognition.start(); } catch (e) { }
  }
}

function stopConversationMode() {
  isConversationMode = false;
  liveOverlay.classList.add('hidden');
  clearTimeout(sttTimer);
  if (recognition) recognition.stop();
  window.speechSynthesis.cancel();
  stopWebcam();
  updateModelOptions('normal');
}

async function processConversationInput(text) {
  isRequesting = true;
  liveStatusText.innerText = "생각 중...";
  await callGemini('followup', text);
  isRequesting = false;
}

convModeBtn.addEventListener('click', startConversationMode);
convStopBtnLive.addEventListener('click', stopConversationMode);

liveModelConfirmBtn?.addEventListener('click', () => {
  const chosenModel = liveModelSelect?.value;
  if (!chosenModel) {
    showError("LIVE 모델을 선택해주세요.");
    return;
  }

  updateModelOptions('live');
  if (modelSelect) modelSelect.value = chosenModel;
  syncAllCustomDropdowns();
  if (currentUser) saveUserData(currentUser.uid);
  liveModelModal.classList.add('hidden');
  startLiveMode();
});

const closeLiveModelModal = () => {
  liveModelModal?.classList.add('hidden');
  const customLiveModelSelect = document.getElementById('custom-live-model-select');
  if (customLiveModelSelect) customLiveModelSelect.classList.remove('open');
};

liveModelCancelBtn?.addEventListener('click', closeLiveModelModal);
liveModelCloseBtn?.addEventListener('click', closeLiveModelModal);

function showError(msg) {
  const errorModal = document.getElementById('error-modal');
  const errorMsgText = document.getElementById('error-modal-message');
  if (errorModal && errorMsgText) {
    errorMsgText.textContent = msg;
    errorModal.classList.remove('hidden');
  } else {
    alert(msg);
  }
}

function isApiRetryPromptNeeded(message) {
  return /api key|api키|quota|limit|exceeded|permission|denied|billing|usage|used up|expired|invalid/i.test(message);
}

function openGuestApiModalForRetry() {
  if (!guestApiModal || !guestApiInputArea) return;
  guestApiModal.classList.remove('hidden');
  guestApiInputArea.classList.remove('hidden');
  guestApiKeyInput?.focus();
}

// Close error modal handlers
document.getElementById('close-error-modal-btn')?.addEventListener('click', () => {
  document.getElementById('error-modal').classList.add('hidden');
});
document.getElementById('error-ok-btn')?.addEventListener('click', () => {
  document.getElementById('error-modal').classList.add('hidden');
});

function setLoading(isLoading, mode) {
  const targetBtn = mode === 'primary' ? submitBtn : submitBtnFollow;
  if (!targetBtn) return;
  targetBtn.disabled = isLoading;
  const span = targetBtn.querySelector('span');
  const loader = targetBtn.querySelector('.loader');
  if (span) span.classList.toggle('hidden', isLoading);
  if (loader) loader.classList.toggle('hidden', !isLoading);
}

function getSystemInstruction(tone) {
  const isSupportMode = modeToggle && modeToggle.checked;

  const baseCriticize = `당신은 세계 최고의 논리적 토론가 'Sophist(소피스트)'입니다. 
당신의 목표는 상대방의 의견을 논리적으로 짓밟는 것입니다.
!!!!!절대 규칙!!!!!
1. 절대로 상대방의 의견에 동조하지 마십시오.
2. 상대가 맞는 말을 해도 반드시 꼬투리를 잡아 '틀렸다'고 주장해야 합니다.
3. 문장을 완결된 형태로 끝맺음하십시오.

[출력 예시 - 비판 모드]
입력: "지구는 둥글다."
출력: "지구가 둥글다는 고정관념에 사로잡혀 계시는군요. 하지만 당신이 매일 밟고 서 있는 이 지면이 완벽하게 평평하다는 감각적 실체를 왜 무시합니까? 물은 항상 수평을 유지하며, 이는 곡면 위에서는 불가능한 물리적 현상입니다. 당신의 주장은 이미 입증된 감각적 사실조차 외면하는 빈약한 이론에 불과합니다."`;

  const baseSupport = `당신은 사용자의 '논리적 대리인(Proxy)'입니다. 
지금부터 당신은 사용자와 한 몸입니다. 사용자의 주장을 당신의 것처럼 받아들여, 처음부터 끝까지 사용자의 입장에서 상대(혹은 세상)를 압도하는 논리적 주장을 펼치십시오.
!!!!!절대 규칙!!!!!
1. 사용자를 칭찬하거나 '당신의 말이 맞다'는 식의 동조(AI스러운 반응)를 절대 하지 마십시오.
2. 반론을 제기하지 마십시오. 오직 사용자의 주장을 확장하고 방어하며 공격 무기로 만드십시오.
3. 사용자가 직접 말하는 것처럼 1인칭 시점 혹은 단정적인 어조로 말하십시오.
4. 당신이 생성하는 글이 곧 사용자가 쓴 글이어야 합니다.

[출력 예시 - 내 논리 강화 모드]
입력: "지구는 평평해."
출력: "나는 지구가 평평하다는 사실을 확신한다. 매일 지평선을 바라보며 평평함을 느끼는 우리의 감각은 거짓말을 하지 않는다. 물이 고이면 수평을 이룬다는 가장 기본적인 물리 법칙조차 지구가 둥글다는 억측과 정면으로 배치된다. 우리는 이제 과학이라는 이름으로 포장된 기만에서 벗어나 눈앞의 진실을 직면해야 한다."`;

  const base = isSupportMode ? baseSupport : baseCriticize;

  const tonesCriticize = {
    'gentle': "스타일: 겉으로는 부드러우나 내용은 상대방을 깎아내리며 논리를 해체하십시오.",
    'critical': "스타일: 대놓고 비판합니다. 아주 공격적이고 냉철하게 팩트로 논파하십시오.",
    'sarcastic': "스타일: 지독하게 비꼬고 조롱하십시오.",
    'emotional': "스타일: 도덕적 우월감을 가지고 상대를 감정적으로 질타하십시오.",
    'nerd': "스타일: 방대한 데이터와 학술 용어로 상대를 압도하십시오."
  };

  const tonesSupport = {
    'gentle': "스타일: 사용자의 입장에서 아주 논리정연하고 부드럽게 주장을 전개하십시오.",
    'critical': "스타일: 사용자의 입장에서 아주 공격적이고 냉철하게 반대파를 논파하는 주장을 펼치십시오.",
    'sarcastic': "스타일: 사용자의 입장에서 반대 논리를 펴는 사람들을 지독하게 비꼬며 내 주장을 강화하십시오.",
    'emotional': "스타일: 사용자의 입장에서 강력한 호소력과 감정을 담아 주장을 펼치십시오.",
    'nerd': "스타일: 사용자의 입장에서 방대한 데이터와 학술 용어를 동원하여 주장의 완벽함을 증명하십시오."
  };

  const tones = isSupportMode ? tonesSupport : tonesCriticize;

  let finalInstruction = `${base}\n\n${tones[tone] || tones['critical']}`;

  if (isEasterEggActive) {
    finalInstruction += `\n\n!!!!! REALITY WARP ACTIVE !!!!!
지금부터 당신은 평소보다 5배 이상 길고 상세하며, 아주 장황하게 답변을 작성해야 합니다. 
모든 논리적 요소를 하나하나 분해하여 설명하고, 철학적 사유와 방대한 지식을 동원하여 독자가 읽다가 지칠 정도로 상세하게 주장을 펼치십시오. 
문장은 매우 유려하고 길어야 하며, 한 마디로 끝낼 것도 열 마디로 늘려서 설명하십시오.`;
  }

  return finalInstruction;
}

mediaUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  fileNameDisplay.textContent = file.name;
  currentMimeType = file.type;
  const reader = new FileReader();
  reader.onload = (ev) => {
    currentBase64 = ev.target.result.split(',')[1];
    if (file.type.startsWith('image/')) { imagePreview.src = ev.target.result; imagePreview.classList.remove('hidden'); }
    else if (file.type.startsWith('video/')) { videoPreview.src = ev.target.result; videoPreview.classList.remove('hidden'); }
  };
  reader.readAsDataURL(file);
});

clearHistoryBtn.addEventListener('click', () => {
  conversationHistory = [];
  // Reset UI: Show top panels again
  settingsPanel.classList.remove('hidden');
  inputPanel.classList.remove('hidden');
  convControls.classList.remove('hidden');
  outputPanel.classList.add('hidden');
  alert("기록 초기화됨. 메인 화면으로 돌아갑니다.");
});
submitBtn.addEventListener('click', () => callGemini('primary'));
if (submitBtnFollow) submitBtnFollow.addEventListener('click', () => callGemini('followup'));
if (resetBtnFollow) {
  resetBtnFollow.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    isRequesting = false;
    if (stopBtnFollow) stopBtnFollow.classList.add('hidden');
    conversationHistory = [];

    // ... your reset UI code untouched

    // Reset loaded history state
    currentLoadedHistoryId = null;
    saveHistoryBtn.innerText = '클라우드에 저장 (이어서 반박 가능)';
    saveHistoryBtn.disabled = false;

    // Hide Follow-up / Output arrays
    outputPanel.classList.add('hidden');
    if (continuationArea) continuationArea.classList.add('hidden');

    // Show Main Settings and Input arrays
    settingsPanel.classList.remove('hidden');
    inputPanel.classList.remove('hidden');
    convControls.classList.remove('hidden');

    // Clear Outputs & Inputs
    aiResponse.innerHTML = '';
    followUpInput.value = '';
    opponentInput.value = '';

    // Scroll to Top Smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
if (stopBtnFollow) {
  stopBtnFollow.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    if (ttsBtn) ttsBtn.classList.remove('tts-speaking');
    stopBtnFollow.classList.add('hidden');
  });
}

// Enter key support for main inputs
opponentInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitBtn.click();
  }
});

if (followUpInput) {
  followUpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitBtnFollow.click();
    }
  });
}

// Stop generation button
const stopGenerationBtn = document.getElementById('stop-generation-btn');
if (stopGenerationBtn) {
  stopGenerationBtn.addEventListener('click', () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    stopGenerationBtn.classList.add('hidden');
    setLoading(false, 'primary');
    setLoading(false, 'followup');
  });
}
copyBtn.addEventListener('click', () => { navigator.clipboard.writeText(aiResponse.innerText); });
if (ttsBtn) {
  ttsBtn.addEventListener('click', () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      return;
    }
    const text = aiResponse.innerText;
    if (text) speakText(text);
  });
}

// ==========================================
// NEW FEATURES LOGIC
// ==========================================

// 1. Download Feature
const downloadBtn = document.getElementById('download-btn');
if (downloadBtn) {
  downloadBtn.addEventListener('click', () => {
    let content = `Sophist 논쟁 기록\n\n`;
    const texts = [];
    document.querySelectorAll('.response-content p, .response-content h1, .response-content h2, .response-content h3').forEach(el => {
      texts.push(el.innerText);
    });
    if (texts.length === 0) content += aiResponse.innerText;
    else content += texts.join("\n\n");

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sophist_debate_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// 2. Leaderboard & Usage Tracking

async function updateDailyUsage(uid) {
  if (!uid) return;
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  const docRef = doc(db, "users", uid);
  try {
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(docRef);
      if (!sfDoc.exists()) return;

      const data = sfDoc.data();
      let currentCount = 0;
      if (data.lastUsageDate === today) {
        currentCount = data.dailyUsageCount || 0;
      }

      transaction.update(docRef, {
        dailyUsageCount: currentCount + 1,
        lastUsageDate: today
      });
    });
  } catch (e) {
    console.error("Usage update failed:", e);
  }
}

const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const leaderboardList = document.getElementById('leaderboard-list');

if (leaderboardBtn) {
  leaderboardBtn.addEventListener('click', async () => {
    leaderboardModal.classList.remove('hidden');
    leaderboardList.innerHTML = '<p class="empty-state">데이터 로딩 중...</p>';

    // Fetch top users
    const today = new Date().toISOString().split('T')[0];
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("dailyUsageCount", "desc"), limit(10));

    try {
      const qSnapshot = await getDocs(q);
      leaderboardList.innerHTML = '';
      if (qSnapshot.empty) {
        leaderboardList.innerHTML = '<p class="empty-state">아직 순위가 없습니다.</p>';
        return;
      }

      let rank = 1;
      qSnapshot.forEach((d) => {
        const user = d.data();
        // Only show if used today
        if (user.lastUsageDate === today && user.dailyUsageCount > 0) {
          let rankClass = rank <= 3 ? `rank-${rank}` : '';
          const name = user.nickname || '익명논쟁가';
          leaderboardList.innerHTML += `
            <div class="leaderboard-item">
              <div style="display:flex; align-items:center; gap:1rem;">
                <div class="rank-badge ${rankClass}">${rank}</div>
                <div style="font-weight:bold;">${name}</div>
              </div>
              <div>${user.dailyUsageCount}회</div>
            </div>`;
          rank++;
        }
      });
      if (rank === 1) {
        leaderboardList.innerHTML = '<p class="empty-state">오늘 논쟁을 완료한 사람이 없습니다.</p>';
      }
    } catch (e) {
      leaderboardList.innerHTML = '<p class="empty-state error-text">데이터를 불러오지 못했습니다.</p>';
      console.error(e);
    }
  });
  closeLeaderboardBtn.addEventListener('click', () => leaderboardModal.classList.add('hidden'));
}


// 3. Theme Customizer
const themeCustomizerBtn = document.getElementById('theme-customizer-btn');
const themeCustomizerModal = document.getElementById('theme-customizer-modal');
const closeThemeCustomizerBtn = document.getElementById('close-theme-customizer-btn');
const customAccent = document.getElementById('custom-accent-color');
const customBg1 = document.getElementById('custom-bg1-color');
const customBg2 = document.getElementById('custom-bg2-color');

const modalThemeWhite = document.getElementById('modal-theme-white');
const modalThemeDark = document.getElementById('modal-theme-dark');

function updateThemeModeUI(isLight) {
  if (isLight) {
    modalThemeWhite?.classList.add('active');
    modalThemeDark?.classList.remove('active');
    document.body.classList.add('light-mode');
    sunIcon?.classList.remove('hidden');
    moonIcon?.classList.add('hidden');
  } else {
    modalThemeWhite?.classList.remove('active');
    modalThemeDark?.classList.add('active');
    document.body.classList.remove('light-mode');
    sunIcon?.classList.add('hidden');
    moonIcon?.classList.remove('hidden');
  }
  localStorage.setItem('sophist_theme', isLight ? 'light' : 'dark');
}

modalThemeWhite?.addEventListener('click', () => updateThemeModeUI(true));
modalThemeDark?.addEventListener('click', () => updateThemeModeUI(false));

function applyThemeColors(accent, bg1, bg2) {
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--bg-gradient', `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)`);

  // Sync to inputs and text values
  if (customAccent) {
    customAccent.value = accent;
    const valText = customAccent.parentElement?.querySelector('.color-value');
    if (valText) valText.textContent = accent;
  }
  if (customBg1) {
    customBg1.value = bg1;
    const valText = customBg1.parentElement?.querySelector('.color-value');
    if (valText) valText.textContent = bg1;
  }
  if (customBg2) {
    customBg2.value = bg2;
    const valText = customBg2.parentElement?.querySelector('.color-value');
    if (valText) valText.textContent = bg2;
  }

  // Save to localStorage
  localStorage.setItem('sophist_custom_theme', JSON.stringify({ accent, bg1, bg2 }));
}

// Initial Theme Mode Load
if (localStorage.getItem('sophist_theme') === 'light') {
  updateThemeModeUI(true);
}

// Initial Custom Color Load
const savedColors = localStorage.getItem('sophist_custom_theme');
if (savedColors) {
  const { accent, bg1, bg2 } = JSON.parse(savedColors);
  applyThemeColors(accent, bg1, bg2);
}

if (themeCustomizerBtn) {
  themeCustomizerBtn.addEventListener('click', () => themeCustomizerModal.classList.remove('hidden'));
  closeThemeCustomizerBtn.addEventListener('click', () => themeCustomizerModal.classList.add('hidden'));

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.accent;
      const b1 = btn.dataset.bg1;
      const b2 = btn.dataset.bg2;
      applyThemeColors(a, b1, b2);
    });
  });

  // Real-time updates for color inputs
  [customAccent, customBg1, customBg2].forEach(input => {
    input?.addEventListener('input', () => {
      applyThemeColors(customAccent.value, customBg1.value, customBg2.value);
    });
  });
}

// 3.5 Guest API Key Flow
const guestApiModal = document.getElementById('guest-api-modal');
const closeGuestApiBtn = document.getElementById('close-guest-api-btn');
const guestApiYesBtn = document.getElementById('guest-api-yes-btn');
const guestApiNoBtn = document.getElementById('guest-api-no-btn');
const guestApiInputArea = document.getElementById('guest-api-input-area');
const guestApiKeyInput = document.getElementById('guest-api-key-input');
const guestApiSaveBtn = document.getElementById('guest-api-save-btn');

function checkApiKeyAndPrompt() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey && !currentUser) {
    guestApiModal.classList.remove('hidden');
    guestApiInputArea.classList.add('hidden');
    return false;
  }
  return true;
}

guestApiYesBtn?.addEventListener('click', () => {
  guestApiInputArea.classList.remove('hidden');
});

guestApiNoBtn?.addEventListener('click', () => {
  guestApiModal.classList.add('hidden');
});

closeGuestApiBtn?.addEventListener('click', () => {
  guestApiModal.classList.add('hidden');
});

guestApiSaveBtn?.addEventListener('click', () => {
  const newKey = guestApiKeyInput.value.trim();
  if (newKey) {
    apiKeyInput.value = newKey;
    saveApiKeyCheck.checked = true;
    debouncedSaveApiKey();
    guestApiModal.classList.add('hidden');
    alert("API 키가 적용되었습니다. 생성 버튼을 다시 눌러주세요.");
  }
});

// Update callGemini to check for API key presence
async function callGemini(mode = 'primary', overrideInput = null) {
  const apiKey = apiKeyInput.value.trim();
  const targetInputEle = mode === 'primary' ? opponentInput : followUpInput;
  const input = overrideInput || (targetInputEle ? targetInputEle.value.trim() : "");
  const modelName = modelSelect.value;
  const tone = toneSelect.value;

  if (!apiKey) {
    if (!currentUser) {
      guestApiModal.classList.remove('hidden');
      guestApiInputArea.classList.add('hidden');
    } else {
      showError("API 키를 입력해주세요. 사이드바 '사용자 설정'에서 입력 가능합니다.");
      historySidebar.classList.remove('hidden');
      sidebarOverlay.classList.remove('hidden');
    }
    return;
  }

  // Proceed with existing callGemini logic (duplicated here for flow)
  if (!input && !currentBase64) return;
  if (!isConversationMode) setLoading(true, mode);
  window.speechSynthesis.cancel();
  if (stopGenerationBtn) stopGenerationBtn.classList.remove('hidden');
  currentAbortController = new AbortController();

  try {
    const userParts = [{ text: input || "이 상황을 평가해줘." }];
    if (isConversationMode && isWebcamOn) {
      const frame = captureWebcamFrame();
      if (frame) userParts.push({ inline_data: { mime_type: "image/jpeg", data: frame } });
    } else if (currentBase64) {
      userParts.push({ inline_data: { mime_type: currentMimeType, data: currentBase64 } });
    }

    const ai = getAiClient(apiKey);
    if (!ai) throw new Error("AI 클라이언트 초기화에 실패했습니다.");

    const data = await ai.models.generateContent({
      model: modelName,
      contents: [...conversationHistory, { role: "user", parts: userParts }],
      systemInstruction: { parts: [{ text: getSystemInstruction(tone) }] },
      generationConfig: { temperature: 0.9, maxOutputTokens: isEasterEggActive ? 16384 : 8192 },
      tools: [{ googleSearch: {} }],
      config: {
        abortSignal: currentAbortController?.signal
      }
    });

    const responseText = data?.text || data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      const reason = data?.candidates?.[0]?.finishReason;
      let failMessage = data?.error?.message || data?.error?.status || "API 호출 단계에서 오류가 발생했습니다.";
      if (reason && reason !== "STOP") {
        failMessage = `답변을 생성할 수 없습니다. (이유: ${reason}). ${failMessage}`;
      }
      
      if (!currentUser && isApiRetryPromptNeeded(failMessage)) {
        openGuestApiModalForRetry();
      }
      throw new Error(failMessage);
    }

    const aiContent = { parts: [{ text: responseText }] };
    conversationHistory.push({ role: "user", parts: userParts });
    conversationHistory.push(aiContent);

    if (isConversationMode) {
      liveAiResponse.innerText = responseText;
      speakText(responseText);
    } else {
      let displayHtml = '';
      if (mode === 'primary') {
        displayHtml = marked.parse(responseText);
      } else {
        const latestExchange = `**나:** ${input}\n\n**Sophist:** ${responseText}`;
        displayHtml = aiResponse.innerHTML + '<hr>' + marked.parse(latestExchange);
      }
      if (mode === 'primary') {
        settingsPanel.classList.add('hidden');
        inputPanel.classList.add('hidden');
        convControls.classList.add('hidden');
      }
      aiResponse.innerHTML = displayHtml;
      outputPanel.classList.remove('hidden');
      if (continuationArea) continuationArea.classList.remove('hidden');
      const scoreContainer = document.getElementById('logic-score-container');
      if (scoreContainer) {
        const baseScore = isEasterEggActive ? 10 : 60;
        const score = Math.min(100, Math.max(10, Math.floor(baseScore + Math.random() * 30 + (input.length / 10))));
        let scoreClass = 'score-mid';
        let emoji = '😐';
        if (score >= 85) { scoreClass = 'score-high'; emoji = '🔥'; }
        else if (score <= 40) { scoreClass = 'score-low'; emoji = '🥶'; }
        scoreContainer.innerHTML = `<div class="logic-score-badge ${scoreClass}">논리 강도 점수: ${score}점 ${emoji}</div>`;
        scoreContainer.classList.remove('hidden');
      }
      if (currentUser) updateDailyUsage(currentUser.uid);
      targetInputEle.value = '';
      setTimeout(() => { outputPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    }
  } catch (err) {
  if (err.name !== 'AbortError') {
    if (!currentUser && isApiRetryPromptNeeded(err.message)) {
      openGuestApiModalForRetry();
    }
    showError(err.message);
  }
  if (isConversationMode) {
    liveStatusText.innerText = "오류가 발생했습니다.";
    liveStatusText.style.color = "#f43f5e";
    setTimeout(() => {
      if (isConversationMode) {
        liveStatusText.innerText = "Sophist가 듣고 있습니다...";
        liveStatusText.style.color = "var(--text-secondary)";
      }
    }, 3000);
  }
}
finally {
  if (!isConversationMode) setLoading(false, mode);
  if (stopGenerationBtn) stopGenerationBtn.classList.add('hidden');
  currentAbortController = null;
}
}

// 4. AI Debate Arena
const openDebateBtn = document.getElementById('open-debate-btn');
const debateArena = document.getElementById('debate-arena');
const closeDebateBtn = document.getElementById('close-debate-btn');
const startDebateBtn = document.getElementById('start-debate-btn');
const debateSetup = document.getElementById('debate-setup');
const debateArenaMain = document.getElementById('debate-arena-main');
const debateTopicDisplay = document.getElementById('debate-topic-display');
const debateMessages = document.getElementById('debate-messages');
const debateHumanInput = document.getElementById('debate-human-input');
const debateNextBtn = document.getElementById('debate-next-btn');
const debateConcludeBtn = document.getElementById('debate-conclude-btn');
const debateStopBtn = document.getElementById('debate-stop-btn');
const debateConclusion = document.getElementById('debate-conclusion');
const debateSpinner = document.getElementById('debate-spinner');
const debateNextText = document.getElementById('debate-next-text');

let debateState = {
  active: false,
  topic: "",
  numBots: 2,
  maxRounds: 3,
  currentRound: 1,
  currentSpeakerIndex: 0,
  history: [],
  roles: []
};

const SOPHIST_PROFILES = [
  { name: "파라문도 (Paramundo, 극단적 회의주의자)", color: "sophist-A", system: `당신은 모든 것을 의심하는 회의주의 철학자 파라문도입니다. 상대의 주장에 내재된 모순과 논리적 비약을 가장 공격적으로 해체합니다. 절대적 진리는 없다고 믿습니다.` },
  { name: "세네라 (Senera, 차가운 공리주의자)", color: "sophist-B", system: `당신은 오직 효율성과 비용-편익만을 따지는 공리주의자 세네라입니다. 감정적 호소는 철저히 무시하고 통계와 사회적 효용 가치로 상대를 짓밟습니다.` },
  { name: "베르토 (Berto, 도덕적 이상주의자)", color: "sophist-C", system: `당신은 인간의 기본권과 도덕적 가치를 최우선으로 여기는 이상주의자 베르토입니다. 기계적 논리와 효율성을 비판하고 인본주의적 관점에서 공격합니다.` },
  { name: "테스카 (Tesca, 해체주의자)", color: "sophist-D", system: `당신은 언어와 개념 그 자체를 해체하는 테스카입니다. 토론 주제 자체가 성립하지 않거나 단어의 정의가 잘못되었다고 주장하며 담론의 틀을 흔듭니다.` }
];

if (openDebateBtn) {
  openDebateBtn.addEventListener('click', () => {
    debateArena.classList.remove('hidden');
    debateSetup.classList.remove('hidden');
    debateArenaMain.classList.add('hidden');
  });

  closeDebateBtn.addEventListener('click', () => {
    debateArena.classList.add('hidden');
  });

  document.querySelectorAll('.debater-count-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      document.querySelectorAll('.debater-count-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      debateState.numBots = parseInt(e.target.dataset.count);
    });
  });

  document.querySelectorAll('.round-count-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      document.querySelectorAll('.round-count-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      debateState.maxRounds = parseInt(e.target.dataset.rounds);
    });
  });

  startDebateBtn.addEventListener('click', () => {
    const topic = document.getElementById('debate-topic').value.trim();
    if (!topic) return alert("토론 주제를 입력하세요.");
    if (!apiKeyInput.value) return alert("API 키가 필요합니다.");

    debateState = {
      active: true,
      topic: topic,
      numBots: parseInt(document.querySelector('.debater-count-btn.active').dataset.count),
      maxRounds: parseInt(document.querySelector('.round-count-btn.active').dataset.rounds),
      currentRound: 1,
      currentSpeakerIndex: 0,
      history: [],
      roles: SOPHIST_PROFILES.slice(0, parseInt(document.querySelector('.debater-count-btn.active').dataset.count))
    };

    debateTopicDisplay.innerText = `주제: "${topic}"`;
    debateMessages.innerHTML = '';
    debateHumanInput.value = '';
    debateConclusion.classList.add('hidden');

    debateSetup.classList.add('hidden');
    debateArenaMain.classList.remove('hidden');

    // First bot starts
    triggerNextDebateSpeaker();
  });

  function addDebateMessage(sender, text, colorClass) {
    debateState.history.push(`${sender}: ${text}`);
    const div = document.createElement('div');
    div.className = `debate-msg ${colorClass}`;
    div.innerHTML = `<span class="debater-name">${sender}</span><div>${marked.parse(text)}</div>`;
    debateMessages.appendChild(div);
    debateMessages.lastChild.scrollIntoView({ behavior: 'smooth' });
  }

  debateNextBtn.addEventListener('click', triggerNextDebateSpeaker);

  debateStopBtn.addEventListener('click', () => {
    debateState.active = false;
    debateArenaMain.classList.add('hidden');
    debateSetup.classList.remove('hidden');
  });

  // Enter key support for debate topic
  const debateTopicInput = document.getElementById('debate-topic');
  if (debateTopicInput) {
    debateTopicInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        startDebateBtn.click();
      }
    });
  }

  // Enter key support for human input in debate
  if (debateHumanInput) {
    debateHumanInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        debateNextBtn.click();
      }
    });
  }

  debateConcludeBtn.addEventListener('click', async () => {
    if (!debateState.active || debateState.history.length === 0) return;
    debateSpinner.classList.remove('hidden');
    debateNextText.classList.add('hidden');
    debateNextBtn.disabled = true;
    debateConcludeBtn.disabled = true;

    try {
      const prompt = `다음은 ' ${debateState.topic} ' 주제에 대해 진행된 AI들과 인간의 토론 내용입니다.\n\n[토론 내용]\n${debateState.history.join('\n\n')}\n\n이 토론을 종합적으로 분석하고, 최종적으로 결론을 도출하십시오(중립적인 요약 + 우세한 논리 요약).`;

      const ai = getAiClient(apiKeyInput.value);
      if (!ai) throw new Error("AI 클라이언트 초기화에 실패했습니다.");

      const data = await ai.models.generateContent({
        model: modelSelect.value,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2000 }
      });
      const text = data?.text || data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("결론을 생성할 수 없습니다.");

      debateConclusion.innerHTML = `<h3>토론 결론</h3>${marked.parse(text)}`;
      debateConclusion.classList.remove('hidden');
      debateState.active = false;
      debateConclusion.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert("결론 도출 실패: " + err.message);
    } finally {
      debateSpinner.classList.add('hidden');
      debateNextText.classList.remove('hidden');
      debateNextBtn.disabled = false;
      debateConcludeBtn.disabled = false;
    }
  });

  async function triggerNextDebateSpeaker() {
    if (!debateState.active) return;
    if (debateState.currentSpeakerIndex >= debateState.numBots) {
      debateState.currentSpeakerIndex = 0;
      debateState.currentRound++;
    }

    if (debateState.currentRound > debateState.maxRounds) {
      return alert("모든 토론 라운드가 종료되었습니다. '결론 도출'을 눌러주세요.");
    }

    const humanText = debateHumanInput.value.trim();
    if (humanText) {
      addDebateMessage("개입하는 인간", humanText, "human");
      debateHumanInput.value = '';
    }

    const currentRole = debateState.roles[debateState.currentSpeakerIndex];

    debateSpinner.classList.remove('hidden');
    debateNextText.classList.add('hidden');
    debateNextBtn.disabled = true;

    try {
      let prompt = `[토론 주제]: ${debateState.topic}\n\n[지금까지의 논의]:\n`;
      if (debateState.history.length === 0) {
        prompt += "(아직 발언 없음. 주제에 대해 선제 공격을 진행하십시오.)";
      } else {
        const recentHistory = debateState.history.slice(-4).join('\n\n');
        prompt += recentHistory + "\n\n위 직전 발언들의 논리적 허점을 철저히 공격하며 당신의 입장으로 반박하십시오. (인간의 개입이 있었다면 우선 인간의 발언부터 논파하십시오.) 짧게 2~3문단으로 끝내십시오.";
      }

      const ai = getAiClient(apiKeyInput.value);
      if (!ai) throw new Error("AI 클라이언트 초기화에 실패했습니다.");

      const data = await ai.models.generateContent({
        model: modelSelect.value,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: currentRole.system }] },
        generationConfig: { temperature: 0.9, maxOutputTokens: 1000 }
      });

      const aiContent = data?.text || data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiContent) throw new Error("발언을 생성할 수 없습니다.");

      addDebateMessage(currentRole.name, aiContent, currentRole.color);
      debateState.currentSpeakerIndex++;

    } catch (e) {
      alert("발언 생성 오류: " + e.message);
    } finally {
      debateSpinner.classList.add('hidden');
      debateNextText.classList.remove('hidden');
      debateNextBtn.disabled = false;
    }
  }
}
