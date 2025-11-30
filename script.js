
/* ---------------------------------------------------------
   Game Of Codes – Full Fixed Gemini Chatbot Script
   (NO model errors + sidebar fixed + working chat)
------------------------------------------------------------*/

// ---------- VALID MODELS ----------
const VALID_MODELS = {
  "gemini-2.0-flash": "gemini-2.0-flash",
  "gemini-1.5-flash": "gemini-1.5-flash", 
  "gemini-1.5-pro": "gemini-1.5-pro",
  "gemini-2.5-flash": "gemini-2.5-flash"
};

// ---------- CONFIG ----------
let MODEL = "gemini-2.5-flash";   // default safe model
let CLIENT_API_KEY = "AIzaSyCKVBC6JcHmsLRQfIHmm6YH4uDT0559es8";

function buildUrl(key) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
}


/* ---------- DOM ---------- */
const chatBody = document.getElementById("chat-body");
const chatInput = document.getElementById("chat-input");
const fileInput = document.getElementById("file-input");
const fileUploadBtn = document.getElementById("file-upload");
const sendMessageBtn = document.getElementById("send-message");
const cameraBtn = document.getElementById("camera-capture-btn");
const emojiBtn = document.getElementById("emoji-picker");
const micToggle = document.getElementById("mic-toggle");
const ttsToggle = document.getElementById("tts-toggle");
const modelSelect = document.getElementById("model-select");

/* ---------- STATE ---------- */
let chatHistory = JSON.parse(localStorage.getItem("goc_chat_history") || "[]");
let outgoingFiles = [];
let useTTS = false;
let isRecording = false;
let recognizer;

/* ---------- HELPERS ---------- */
function scrollToBottom(){ chatBody.scrollTo({top: chatBody.scrollHeight, behavior:"smooth"}); }
function saveHistory(){ localStorage.setItem("goc_chat_history", JSON.stringify(chatHistory)); }

function el(tag, cls="", html=""){
  const d = document.createElement(tag);
  if(cls) d.className = cls;
  if(html) d.innerHTML = html;
  return d;
}

/* ---------- RENDER HISTORY ---------- */
function renderHistory(){
  chatBody.innerHTML = "";
  chatHistory.forEach(m=>{
    const txt = (m.parts||[]).map(p=>p.text||"").join("<br>");
    appendMessage({role:m.role==="user"?"user":"bot", text:txt});
  });
}

/* ---------- APPEND MESSAGE ---------- */
function appendMessage({role="bot", text="", thinking=false}){
  const wrap = el("div", `msg ${role}-message`);
  const bubble = el("div", "msg-bubble");

  if(thinking){
    bubble.innerHTML = `<div class="typing"><span>•</span><span>•</span><span>•</span></div>`;
    wrap.classList.add("thinking");
  } else {
    bubble.innerHTML = text.replace(/\n/g,"<br>");
  }

  wrap.appendChild(bubble);
  chatBody.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

/* ---------- FILE UPLOAD ---------- */
fileUploadBtn.onclick = ()=> fileInput.click();

fileInput.onchange = async ()=>{
  const files = [...fileInput.files];
  for(const f of files){
    const b64 = await fileToBase64(f);
    outgoingFiles.push({ data:b64, mime_type:f.type });
    appendMessage({role:"user", text:`📎 Attached: ${f.name}`});
  }
  fileInput.value="";
};

function fileToBase64(file){
  return new Promise(res=>{
    const r = new FileReader();
    r.onload = ()=> res(r.result.split(",")[1]);
    r.readAsDataURL(file);
  });
}

/* ---------- CAMERA CAPTURE ---------- */
cameraBtn.onclick = async ()=>{
  try{
    const stream = await navigator.mediaDevices.getUserMedia({video:true});
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();

    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d").drawImage(video,0,0);

    const b64 = c.toDataURL("image/png").split(",")[1];
    outgoingFiles.push({data:b64, mime_type:"image/png"});
    appendMessage({role:"user", text:"📷 Camera image captured"});

    stream.getTracks().forEach(t=>t.stop());
  } catch(e){ alert("Camera error: "+e.message); }
};

/* ---------- EMOJI PICKER ---------- */
emojiBtn.onclick = ()=>{
  const e = prompt("Enter emoji:");
  if(e) chatInput.value += e;
};

/* ---------- SPEECH RECOGNITION ---------- */
micToggle.onclick = ()=>{
  if(isRecording) stopVoice();
  else startVoice();
};

function startVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return alert("Speech recognition not supported");

  recognizer = new SR();
  recognizer.lang="en-US";
  recognizer.onresult = e=> chatInput.value = e.results[0][0].transcript;

  recognizer.start();
  isRecording=true;
  micToggle.textContent="⏹️";
}

function stopVoice(){
  recognizer?.stop();
  isRecording=false;
  micToggle.textContent="🎤";
}

/* ---------- TTS ---------- */
ttsToggle.onclick = ()=>{
  useTTS = !useTTS;
  ttsToggle.style.opacity = useTTS ? "1" : "0.5";
};

function speak(text){
  if(useTTS){
    const u = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(u);
  }
}

/* ---------- SEND MESSAGE ---------- */
document.getElementById("chat-form").onsubmit = e=>{
  e.preventDefault();
  sendMessage();
};
sendMessageBtn.onclick = sendMessage;

async function sendMessage(){
  const text = chatInput.value.trim();
  if(!text && outgoingFiles.length===0) return;

  appendMessage({role:"user", text});

  let parts = [];
  if(text) parts.push({text});
  outgoingFiles.forEach(f=> parts.push({inline_data:f}));

  chatHistory.push({role:"user", parts});
  saveHistory();

  chatInput.value="";
  outgoingFiles=[];

  const typing = appendMessage({role:"bot", thinking:true});

  try{
    MODEL = modelSelect.value;
    const reply = await callGemini(CLIENT_API_KEY, chatHistory);

    typing.remove();
    appendMessage({role:"bot", text: reply});

    chatHistory.push({role:"model", parts:[{text:reply}]});
    saveHistory();
    speak(reply);

  }catch(e){
    typing.remove();
    appendMessage({role:"bot", text:`Error: ${e.message}`});
  }
}

/* ---------- GEMINI API ---------- */
async function callGemini(apiKey, history){
  const res = await fetch(buildUrl(apiKey), {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({contents:history}),
  });

  const data = await res.json();
  if(!res.ok) throw new Error(data.error?.message || "API error");

  return data.candidates[0].content.parts[0].text;
}

/* ---------- CLEAR / EXPORT ---------- */
document.getElementById("clear-chat").onclick = ()=>{
  chatHistory=[];
  saveHistory();
  renderHistory();
};

document.getElementById("new-chat").onclick = ()=>{
  chatHistory=[];
  saveHistory();
  renderHistory();
};

document.getElementById("export-chat").onclick = ()=>{
  const blob = new Blob([JSON.stringify(chatHistory,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download="chat.json";
  a.click();
};

/* ---------- SIDEBAR PAGE LOGIC ---------- */
document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");

    showPage(btn.dataset.page);
  });
});

function showPage(page){

  document.querySelector(".hero").style.display="none";
  document.querySelector(".workspace").style.display="none";
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));

  if(page==="home"){
    document.querySelector(".hero").style.display="block";
    document.querySelector(".workspace").style.display="flex";
  } else {
    const sec = document.getElementById("page-"+page);
    if(sec) sec.classList.remove("hidden");
  }
}

/* ---------- INIT ---------- */
renderHistory();

/* -------------------------------
    CHAT HISTORY PAGE RENDERING
--------------------------------*/

function updateHistoryPage() {
  const page = document.getElementById("page-history");

  if (!chatHistory || chatHistory.length === 0) {
    page.innerHTML = `
      <h2 class="page-title">History</h2>
      <p class="page-empty">📜 No chat history yet.</p>
    `;
    return;
  }

  // Build history entries
  let html = `
    <h2 class="page-title">History</h2>
    <div class="history-list">
  `;

  chatHistory.forEach((msg, index) => {
    if (msg.role === "user") {
      const preview = msg.parts[0]?.text?.substring(0, 50) || "Message";
      html += `
        <div class="history-item" data-index="${index}">
          <div class="history-preview">${preview}...</div>
          <div class="history-time">${new Date().toLocaleString()}</div>
        </div>
      `;
    }
  });

  html += `</div>`;
  page.innerHTML = html;

  // Click event: load previous chat state
  document.querySelectorAll(".history-item").forEach(item => {
    item.onclick = () => {
      loadHistoryChat();
      showPage("home");
      document.querySelector("[data-page='home']").classList.add("active");
    };
  });
}

function loadHistoryChat() {
  renderHistory();
  scrollToBottom();
}

function showPage(page) {

  document.querySelector(".hero").style.display = "none";
  document.querySelector(".workspace").style.display = "none";
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));

  if (page === "home") {
    document.querySelector(".hero").style.display = "block";
    document.querySelector(".workspace").style.display = "flex";
  } 
  else if (page === "history") {
    updateHistoryPage(); // <-- auto fill history page
    document.getElementById("page-history").classList.remove("hidden");
  } 
  else {
    document.getElementById("page-" + page).classList.remove("hidden");
  }
}