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
let isWebcamOn = true;
let mediaStream = null;
let activeUtterance = null;
let sttTimer = null;
let lastTranscript = "";
let isRequesting = false; 
const SPEECH_RECOGNITION_SENSITIVITY = 1800;

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

apiKeyInput.addEventListener('input', () => {
  if (saveApiKeyCheck.checked) localStorage.setItem(STORAGE_KEY, simpleEncrypt(apiKeyInput.value));
});

saveApiKeyCheck.addEventListener('change', () => {
  if (saveApiKeyCheck.checked) localStorage.setItem(STORAGE_KEY, simpleEncrypt(apiKeyInput.value));
  else localStorage.removeItem(STORAGE_KEY);
});

// --- Theme Toggle ---
themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('sophist_theme', isLight ? 'light' : 'dark');
  sunIcon.classList.toggle('hidden');
  moonIcon.classList.toggle('hidden');

  // Easter Egg Logic
  themeClickCount++;
  if (themeClickCount === 20) {
    triggerEasterEgg();
    themeClickCount = 0;
  }
});

function triggerEasterEgg() {
  const h1 = document.querySelector('.header h1');
  const originalText = "Sophist"; 
  
  if (!isEasterEggActive) {
    // Turn ON
    isEasterEggActive = true;
    h1.textContent = "REALITY WARP";
    document.body.style.transition = "all 0.1s";
    
    let i = 0;
    easterEggInterval = setInterval(() => {
      document.body.style.filter = `hue-rotate(${i * 72}deg) invert(0.2)`;
      h1.style.transform = `scale(${1 + Math.random() * 0.1}) rotate(${Math.random() * 4 - 2}deg)`;
      i++;
    }, 150);
    alert("Sophist: 현실 왜곡 모드가 활성화되었습니다. 진실이 뒤섞입니다.");
  } else {
    // Turn OFF
    isEasterEggActive = false;
    clearInterval(easterEggInterval);
    document.body.style.filter = "none";
    document.body.style.transition = "all 0.5s";
    h1.textContent = originalText;
    h1.style.transform = "none";
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
      // If user starts speaking while AI is speaking, interrupt AI
      if (isSpeaking && text.trim().length > 0) {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        isRequesting = false; // Reset request state to allow new generation
      }

      lastTranscript = text;
      liveUserTranscript.innerText = text;
      
      clearTimeout(sttTimer);
      sttTimer = setTimeout(() => {
        if (isConversationMode && lastTranscript.trim() && !isRequesting) {
          processConversationInput(lastTranscript);
          // Clear the STT results accumulation by stopping and restarting
          try { recognition.stop(); } catch(e){}
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
       } catch(e){}
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
      if (isConversationMode) {
        liveStatusText.innerText = "Sophist가 이야기 중...";
        liveStatusText.style.color = "var(--accent)";
      }
    };

    activeUtterance.onend = () => {
      isSpeaking = false;
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
  isConversationMode = true;
  lastTranscript = "";
  liveOverlay.classList.remove('hidden');
  await startWebcam();
  if (recognition) {
    try { recognition.start(); } catch(e){}
  }
}

function stopConversationMode() {
  isConversationMode = false;
  liveOverlay.classList.add('hidden');
  clearTimeout(sttTimer);
  if (recognition) recognition.stop();
  window.speechSynthesis.cancel();
  stopWebcam();
}

async function processConversationInput(text) {
  isRequesting = true;
  liveStatusText.innerText = "생각 중...";
  await callGemini('followup', text);
  isRequesting = false;
}

convModeBtn.addEventListener('click', startConversationMode);
convStopBtnLive.addEventListener('click', stopConversationMode);

// --- Gemini API Implementation ---
async function callGemini(mode = 'primary', overrideInput = null) {
  const apiKey = apiKeyInput.value.trim();
  const targetInputEle = mode === 'primary' ? opponentInput : followUpInput;
  const input = overrideInput || (targetInputEle ? targetInputEle.value.trim() : "");
  const modelName = modelSelect.value;
  const tone = toneSelect.value;

  if (!apiKey || (!input && !currentBase64)) return;

  if (!isConversationMode) setLoading(true, mode);
  window.speechSynthesis.cancel();

  try {
    const userParts = [{ text: input || "이 상황을 평가해줘." }];
    if (isConversationMode && isWebcamOn) {
      const frame = captureWebcamFrame();
      if (frame) userParts.push({ inline_data: { mime_type: "image/jpeg", data: frame } });
    } else if (currentBase64) {
      userParts.push({ inline_data: { mime_type: currentMimeType, data: currentBase64 } });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [...conversationHistory, { role: "user", parts: userParts }],
        systemInstruction: { parts: [{ text: getSystemInstruction(tone) }] },
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 8192 }
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0].content) {
      const aiContent = data.candidates[0].content;
      conversationHistory.push({ role: "user", parts: userParts });
      conversationHistory.push(aiContent);
      
      const responseText = aiContent.parts[0].text;
      
      if (isConversationMode) {
        // Show full response instead of truncating
        liveAiResponse.innerText = responseText;
        speakText(responseText);
      } else {
        // UI Transition Logic: Hide top panels on FIRST primary response
        if (mode === 'primary') {
             settingsPanel.classList.add('hidden');
             inputPanel.classList.add('hidden');
             convControls.classList.add('hidden');
        }

        aiResponse.innerHTML = marked.parse(responseText);
        outputPanel.classList.remove('hidden');
        if (continuationArea) continuationArea.classList.remove('hidden');
        
        // Clear input field after successful generation
        targetInputEle.value = '';
        
        // Scroll smoothly to output
        setTimeout(() => {
          outputPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  } catch (err) { showError(err.message); }
  finally { if (!isConversationMode) setLoading(false, mode); }
}

function setLoading(isLoading, mode) {
  const targetBtn = mode === 'primary' ? submitBtn : submitBtnFollow;
  if (!targetBtn) return;
  targetBtn.disabled = isLoading;
  const span = targetBtn.querySelector('span');
  const loader = targetBtn.querySelector('.loader');
  if (span) span.classList.toggle('hidden', isLoading);
  if (loader) loader.classList.toggle('hidden', !isLoading);
}

function showError(msg) { 
  if (errorMsg) {
    errorMsg.textContent = msg; 
    errorMsg.classList.remove('hidden'); 
  } else {
    alert(msg);
  }
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
  return `${base}\n\n${tones[tone] || tones['critical']}`;
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
