(function () {
    "use strict";

    const chatArea = document.getElementById("chatArea");
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const welcomeMsg = document.getElementById("welcomeMsg");
    const welcomeIcon = document.getElementById("welcomeIcon");
    const welcomeTitle = document.getElementById("welcomeTitle");
    const welcomeText = document.getElementById("welcomeText");
    const tabs = document.querySelectorAll(".tab");
    const menuBtn = document.getElementById("menuBtn");
    const newChatBtn = document.getElementById("newChatBtn");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const sidebarClose = document.getElementById("sidebarClose");
    const chatList = document.getElementById("chatList");

    let currentMode = "finance";
    let currentChatId = null;
    let currentMessages = [];

    // --- Storage ---
    const STORAGE_KEY = "berater_chats";

    function loadAllChats() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch { return []; }
    }

    function saveAllChats(chats) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function saveCurrentChat() {
        if (currentMessages.length === 0) return;

        const chats = loadAllChats();
        const firstUserMsg = currentMessages.find(m => m.role === "user");
        const title = firstUserMsg ? firstUserMsg.content.slice(0, 60) : "Neuer Chat";

        const existing = chats.findIndex(c => c.id === currentChatId);
        const chatData = {
            id: currentChatId,
            mode: currentMode,
            title: title,
            messages: currentMessages,
            updatedAt: new Date().toISOString(),
        };

        if (existing >= 0) {
            chats[existing] = chatData;
        } else {
            chatData.createdAt = new Date().toISOString();
            chats.unshift(chatData);
        }

        saveAllChats(chats);
    }

    function deleteChat(id) {
        const chats = loadAllChats().filter(c => c.id !== id);
        saveAllChats(chats);
        if (currentChatId === id) {
            startNewChat();
        }
        renderChatList();
    }

    function loadChat(id) {
        const chats = loadAllChats();
        const chat = chats.find(c => c.id === id);
        if (!chat) return;

        currentChatId = chat.id;
        currentMode = chat.mode;
        currentMessages = [...chat.messages];

        // Update mode UI
        document.body.className = currentMode === "health" ? "health-mode" : "";
        tabs.forEach(t => t.classList.toggle("active", t.dataset.mode === currentMode));
        messageInput.placeholder = modeConfig[currentMode].placeholder;

        renderChat();
        closeSidebar();
    }

    function startNewChat() {
        currentChatId = generateId();
        currentMessages = [];
        renderChat();
    }

    // --- Sidebar ---
    function openSidebar() {
        renderChatList();
        sidebar.classList.add("open");
        sidebarOverlay.classList.add("open");
    }

    function closeSidebar() {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("open");
    }

    function renderChatList() {
        const chats = loadAllChats();
        if (chats.length === 0) {
            chatList.innerHTML = '<div class="sidebar-empty">Noch keine gespeicherten Chats.</div>';
            return;
        }

        chatList.innerHTML = "";
        chats.forEach(chat => {
            const item = document.createElement("div");
            item.className = "chat-item" + (chat.id === currentChatId ? " active" : "");

            const icon = chat.mode === "health" ? "💪" : "💰";
            const date = new Date(chat.updatedAt || chat.createdAt);
            const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
                + " " + date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

            item.innerHTML = `
                <span class="chat-item-icon">${icon}</span>
                <div class="chat-item-info">
                    <div class="chat-item-title">${escapeHtml(chat.title)}</div>
                    <div class="chat-item-date">${dateStr}</div>
                </div>
                <button class="chat-item-delete" title="Löschen">&times;</button>
            `;

            item.addEventListener("click", (e) => {
                if (e.target.closest(".chat-item-delete")) return;
                loadChat(chat.id);
            });

            item.querySelector(".chat-item-delete").addEventListener("click", (e) => {
                e.stopPropagation();
                deleteChat(chat.id);
            });

            chatList.appendChild(item);
        });
    }

    function escapeHtml(text) {
        const d = document.createElement("div");
        d.textContent = text;
        return d.innerHTML;
    }

    menuBtn.addEventListener("click", openSidebar);
    sidebarOverlay.addEventListener("click", closeSidebar);
    sidebarClose.addEventListener("click", closeSidebar);
    newChatBtn.addEventListener("click", () => {
        startNewChat();
        closeSidebar();
    });

    // --- Mode switching ---
    const modeConfig = {
        finance: {
            icon: "💰",
            title: "Finanz-Berater",
            text: "Frag mich über Investitionen, Value Investing, Portfolioaufbau und Warren Buffetts Philosophie.",
            placeholder: "Frag etwas über Finanzen...",
        },
        health: {
            icon: "💪",
            title: "Gesundheits-Berater",
            text: "Frag mich über Longevity, Ernährung, Schlaf, Training und evidenzbasierte Gesundheitstipps.",
            placeholder: "Frag etwas über Gesundheit...",
        },
    };

    function switchMode(mode) {
        // Save current chat before switching if it has messages
        if (currentMessages.length > 0) {
            saveCurrentChat();
        }

        currentMode = mode;
        const cfg = modeConfig[mode];

        document.body.className = mode === "health" ? "health-mode" : "";
        tabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));

        welcomeIcon.textContent = cfg.icon;
        welcomeTitle.textContent = cfg.title;
        welcomeText.textContent = cfg.text;
        messageInput.placeholder = cfg.placeholder;

        // Start a new chat for the new mode
        startNewChat();
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => switchMode(tab.dataset.mode));
    });

    // --- Chat rendering ---
    function renderChat() {
        chatArea.querySelectorAll(".message, .typing").forEach((el) => el.remove());

        if (currentMessages.length === 0) {
            welcomeMsg.style.display = "flex";
            const cfg = modeConfig[currentMode];
            welcomeIcon.textContent = cfg.icon;
            welcomeTitle.textContent = cfg.title;
            welcomeText.textContent = cfg.text;
        } else {
            welcomeMsg.style.display = "none";
            currentMessages.forEach((msg) => appendMessage(msg.role, msg.content, false));
        }
        scrollToBottom();
    }

    function appendMessage(role, content, animate = true) {
        welcomeMsg.style.display = "none";

        const div = document.createElement("div");
        div.className = `message ${role}`;
        if (!animate) div.style.animation = "none";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        if (role === "assistant") {
            bubble.innerHTML = renderMarkdown(content);
        } else {
            bubble.textContent = content;
        }

        div.appendChild(bubble);
        chatArea.appendChild(div);
        scrollToBottom();
    }

    function showTyping() {
        const div = document.createElement("div");
        div.className = "typing";
        div.id = "typingIndicator";
        div.innerHTML = "<span></span><span></span><span></span>";
        chatArea.appendChild(div);
        scrollToBottom();
    }

    function hideTyping() {
        const el = document.getElementById("typingIndicator");
        if (el) el.remove();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            chatArea.scrollTop = chatArea.scrollHeight;
        });
    }

    // --- Simple markdown renderer ---
    function renderMarkdown(text) {
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            .replace(/`(.+?)`/g, "<code>$1</code>")
            .replace(/^### (.+)$/gm, "<h3>$1</h3>")
            .replace(/^## (.+)$/gm, "<h2>$1</h2>")
            .replace(/^# (.+)$/gm, "<h1>$1</h1>")
            .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
            .replace(/^---$/gm, "<hr>");

        const lines = html.split("\n");
        let result = "";
        let inList = false;
        let listType = "";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const ulMatch = line.match(/^[-*] (.+)/);
            const olMatch = line.match(/^(\d+)\. (.+)/);

            if (ulMatch) {
                if (!inList || listType !== "ul") {
                    if (inList) result += `</${listType}>`;
                    result += "<ul>";
                    inList = true;
                    listType = "ul";
                }
                result += `<li>${ulMatch[1]}</li>`;
            } else if (olMatch) {
                if (!inList || listType !== "ol") {
                    if (inList) result += `</${listType}>`;
                    result += "<ol>";
                    inList = true;
                    listType = "ol";
                }
                result += `<li>${olMatch[2]}</li>`;
            } else {
                if (inList) {
                    result += `</${listType}>`;
                    inList = false;
                }
                if (line.startsWith("<h") || line.startsWith("<blockquote") || line.startsWith("<hr")) {
                    result += line;
                } else if (line.trim() === "") {
                    result += "";
                } else {
                    result += `<p>${line}</p>`;
                }
            }
        }
        if (inList) result += `</${listType}>`;

        return result;
    }

    // --- Send message ---
    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        messageInput.value = "";
        messageInput.style.height = "auto";
        sendBtn.disabled = true;

        currentMessages.push({ role: "user", content: text });
        appendMessage("user", text);

        // Auto-save after user sends
        saveCurrentChat();

        showTyping();

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    mode: currentMode,
                    history: currentMessages.slice(0, -1),
                }),
            });

            hideTyping();

            if (!res.ok) {
                const err = await res.json();
                appendMessage("assistant", "Fehler: " + (err.error || "Unbekannter Fehler"));
                return;
            }

            const data = await res.json();
            currentMessages.push({ role: "assistant", content: data.reply });
            appendMessage("assistant", data.reply);

            // Auto-save after AI responds
            saveCurrentChat();
        } catch (e) {
            hideTyping();
            appendMessage("assistant", "Verbindungsfehler. Bitte versuche es erneut.");
        } finally {
            updateSendButton();
        }
    }

    // --- Input handling ---
    function updateSendButton() {
        sendBtn.disabled = messageInput.value.trim().length === 0;
    }

    messageInput.addEventListener("input", () => {
        updateSendButton();
        messageInput.style.height = "auto";
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
    });

    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) sendMessage();
        }
    });

    sendBtn.addEventListener("click", sendMessage);

    // Init
    currentChatId = generateId();
    switchMode("finance");
})();
