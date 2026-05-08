/**
 * RealChat — Frontend Client
 * Handles auth flow, Socket.IO events, and UI rendering.
 */

const API = "";          // same origin
let socket = null;
let currentUser = null;
let selectedReceiver = null;
let typingTimer = null;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const authPanel   = document.getElementById("auth-panel");
const chatPanel   = document.getElementById("chat-panel");
const authMsg     = document.getElementById("auth-message");
const userList    = document.getElementById("user-list");
const messagesDiv = document.getElementById("messages");
const msgForm     = document.getElementById("message-form");
const msgInput    = document.getElementById("message-input");
const chatHeader  = document.getElementById("chat-with-name");
const typingEl    = document.getElementById("typing-indicator");

// ─── Helpers ─────────────────────────────────────────────────────────────────
const showMessage = (text, type = "error") => {
  authMsg.textContent = text;
  authMsg.className = `message ${type}`;
};
const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`${tab.dataset.tab}-form`).classList.add("active");
    authMsg.textContent = "";
  });
});

// ─── Auth forms ───────────────────────────────────────────────────────────────
document.getElementById("register-biz-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await fetch(`${API}/api/business/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: document.getElementById("rb-name").value,
      email: document.getElementById("rb-email").value,
      password: document.getElementById("rb-password").value,
    }),
    credentials: "include",
  });
  const data = await res.json();
  if (data.success) {
    showMessage(`✅ Business registered! ID: ${data.data.business._id}`, "success");
  } else {
    showMessage(data.message);
  }
});

document.getElementById("register-user-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await fetch(`${API}/api/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: document.getElementById("ru-name").value,
      email: document.getElementById("ru-email").value,
      password: document.getElementById("ru-password").value,
      businessId: document.getElementById("ru-business-id").value,
    }),
    credentials: "include",
  });
  const data = await res.json();
  if (data.success) {
    showMessage("✅ User registered! You can now log in.", "success");
  } else {
    showMessage(data.message);
  }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await fetch(`${API}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: document.getElementById("login-email").value,
      password: document.getElementById("login-password").value,
      businessId: document.getElementById("login-business-id").value,
    }),
    credentials: "include",
  });
  const data = await res.json();
  if (data.success) {
    currentUser = data.data.user;
    enterChat();
  } else {
    showMessage(data.message);
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────
document.getElementById("logout-btn").addEventListener("click", async () => {
  if (socket) socket.disconnect();
  await fetch(`${API}/api/users/logout`, { method: "POST", credentials: "include" });
  currentUser = null;
  selectedReceiver = null;
  chatPanel.classList.add("hidden");
  authPanel.classList.remove("hidden");
});

// ─── Enter chat ───────────────────────────────────────────────────────────────
function enterChat() {
  authPanel.classList.add("hidden");
  chatPanel.classList.remove("hidden");
  document.getElementById("current-user-name").textContent = currentUser.name;
  connectSocket();
  loadContacts();
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
function connectSocket() {
  socket = io({ withCredentials: true });

  socket.on("connect", () => console.log("Socket connected:", socket.id));
  socket.on("connect_error", (err) => console.error("Socket error:", err.message));

  // Server broadcasts the online user ID set for the business
  socket.on("online_users", (onlineIds) => {
    document.querySelectorAll("#user-list li").forEach((li) => {
      const dot = li.querySelector(".status-dot");
      if (dot) {
        dot.classList.toggle("online", onlineIds.includes(li.dataset.userId));
      }
    });
  });

  socket.on("user_offline", ({ userId }) => {
    const li = document.querySelector(`#user-list li[data-user-id="${userId}"]`);
    if (li) li.querySelector(".status-dot")?.classList.remove("online");
  });

  // Incoming message from another user
  socket.on("new_message", (message) => {
    const isCurrentConv =
      selectedReceiver &&
      (message.sender._id === selectedReceiver._id ||
        message.sender === selectedReceiver._id);
    if (isCurrentConv) appendMessage(message, false);
  });

  // Echo from server confirming our own send
  socket.on("message_sent", (message) => {
    appendMessage(message, true);
    msgInput.value = "";
  });

  // Typing indicators
  socket.on("user_typing", ({ userId, name }) => {
    if (selectedReceiver && userId === selectedReceiver._id) {
      typingEl.textContent = `${name} is typing…`;
    }
  });
  socket.on("user_stopped_typing", ({ userId }) => {
    if (selectedReceiver && userId === selectedReceiver._id) {
      typingEl.textContent = "";
    }
  });

  socket.on("error", ({ message }) => alert(`Socket error: ${message}`));
}

// ─── Contacts ────────────────────────────────────────────────────────────────
async function loadContacts() {
  const res = await fetch(`${API}/api/users`, { credentials: "include" });
  const data = await res.json();
  if (!data.success) return;

  userList.innerHTML = "";
  data.data.users.forEach((user) => {
    const li = document.createElement("li");
    li.dataset.userId = user._id;
    li.innerHTML = `
      <span class="status-dot ${user.online ? "online" : ""}"></span>
      <span class="contact-name">${user.name}</span>
    `;
    li.addEventListener("click", () => selectContact(user, li));
    userList.appendChild(li);
  });
}

// ─── Select contact ────────────────────────────────────────────────────────────
async function selectContact(user, li) {
  selectedReceiver = user;
  document.querySelectorAll("#user-list li").forEach((el) => el.classList.remove("active"));
  li.classList.add("active");
  chatHeader.textContent = user.name;
  typingEl.textContent = "";
  messagesDiv.innerHTML = "";
  msgForm.classList.remove("hidden");

  // Load conversation history (Redis → MongoDB fallback)
  const res = await fetch(`${API}/api/chat/${user._id}`, { credentials: "include" });
  const data = await res.json();
  if (data.success) {
    data.data.messages.forEach((m) => {
      appendMessage(m, m.sender._id === currentUser._id || m.sender === currentUser._id);
    });
  }
}

// ─── Send message ─────────────────────────────────────────────────────────────
msgForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const content = msgInput.value.trim();
  if (!content || !selectedReceiver || !socket) return;

  socket.emit("send_message", { receiverId: selectedReceiver._id, content });
  socket.emit("typing_stop", { receiverId: selectedReceiver._id });
});

// ─── Typing indicator ─────────────────────────────────────────────────────────
msgInput.addEventListener("input", () => {
  if (!selectedReceiver || !socket) return;
  socket.emit("typing_start", { receiverId: selectedReceiver._id });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit("typing_stop", { receiverId: selectedReceiver._id });
  }, 1500);
});

// ─── Render a message bubble ───────────────────────────────────────────────────
function appendMessage(message, isMine) {
  const div = document.createElement("div");
  div.className = `message-bubble ${isMine ? "mine" : "theirs"}`;
  div.innerHTML = `
    ${message.content}
    <span class="msg-time">${formatTime(message.createdAt)}</span>
  `;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
