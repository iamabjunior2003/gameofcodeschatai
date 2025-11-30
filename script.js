const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const sendMessageButton = document.querySelector("#send-message");
const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector("#file-upload-wrapper");
const fileCancelButton = document.querySelector("#file-cancel");
const chatbotToggler = document.querySelector("#chatbot-toggler");
const closeChatbot = document.querySelector("#close-chatbot");

// API setup
const API_KEY = "AIzaSyASf1nivZBq4Y0BbMeY-TO64AZbVpwV11k";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

const userData = {
  message: null,
  file: {
    data: null,
    mime_type: null,
  },
};

const chatHistory = [];
const initialInputHeight = messageInput.scrollHeight;

const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

const generateBotResponse = async (incomingMessageDiv) => {
  const messageElement = incomingMessageDiv.querySelector(".message-text");

  chatHistory.push({
    role: "user",
    parts: [
      { text: userData.message },
      ...(userData.file.data ? [{ inline_data: userData.file }] : []),
    ],
  });

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: chatHistory,
    }),
  };

  try {
    const response = await fetch(API_URL, requestOptions);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

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

const picker = new EmojiMart.Picker({
  theme: "light",
  skinTonePosition: "none",
  preview: "none",
  onEmojiSelect: (emoji) => {
    const { selectionStart: start, selectionEnd: end } = messageInput;
    messageInput.setRangeText(emoji.native, start, end, "end");
    messageInput.focus();
  },
  onClickOutside: (e) => {
    if (e.target.id === "emoji-picker") {
      document.body.classList.toggle("show-emoji-picker");
    } else {
      document.body.classList.remove("show-emoji-picker");
    }
  }
});

document.querySelector(".chat-form").appendChild(picker);




sendMessageButton.addEventListener("click", (e) => handleOutgoingMessage(e));
document
  .querySelector("#file-upload")
  .addEventListener("click", () => fileInput.click());

chatbotToggler.addEventListener("click", () => { 
    document.body.classList.toggle("show-chatbot");
  });

  closeChatbot.addEventListener("click", () => { 
    document.body.classList.remove("show-chatbot");
  });

  // Home screen fade-out after typing animation
window.addEventListener("load", () => {
  const homeScreen = document.getElementById("home-screen");
  setTimeout(() => {
    homeScreen.classList.add("fade-out");
  }, 3500); // wait for typing animation
});