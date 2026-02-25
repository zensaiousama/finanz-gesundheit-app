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

    let currentMode = "finance";
    const chatHistory = { finance: [], health: [] };

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
        currentMode = mode;
        const cfg = modeConfig[mode];

        document.body.className = mode === "health" ? "health-mode" : "";

        tabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));

        welcomeIcon.textContent = cfg.icon;
        welcomeTitle.textContent = cfg.title;
        welcomeText.textContent = cfg.text;
        messageInput.placeholder = cfg.placeholder;

        // Rebuild chat display
        renderChat();
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => switchMode(tab.dataset.mode));
    });

    // --- Chat rendering ---
    function renderChat() {
        // Remove all messages but keep welcome
        chatArea.querySelectorAll(".message, .typing").forEach((el) => el.remove());

        const history = chatHistory[currentMode];
        if (history.length === 0) {
            welcomeMsg.style.display = "flex";
        } else {
            welcomeMsg.style.display = "none";
            history.forEach((msg) => appendMessage(msg.role, msg.content, false));
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
            // Escape HTML
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            // Bold
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            // Italic
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            // Inline code
            .replace(/`(.+?)`/g, "<code>$1</code>")
            // Headers
            .replace(/^### (.+)$/gm, "<h3>$1</h3>")
            .replace(/^## (.+)$/gm, "<h2>$1</h2>")
            .replace(/^# (.+)$/gm, "<h1>$1</h1>")
            // Blockquote
            .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
            // Horizontal rule
            .replace(/^---$/gm, "<hr>");

        // Process lists and paragraphs
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

        // Add to history and display
        chatHistory[currentMode].push({ role: "user", content: text });
        appendMessage("user", text);

        showTyping();

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    mode: currentMode,
                    history: chatHistory[currentMode].slice(0, -1), // exclude last (just sent)
                }),
            });

            hideTyping();

            if (!res.ok) {
                const err = await res.json();
                appendMessage("assistant", "Fehler: " + (err.error || "Unbekannter Fehler"));
                return;
            }

            const data = await res.json();
            chatHistory[currentMode].push({ role: "assistant", content: data.reply });
            appendMessage("assistant", data.reply);
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
        // Auto-resize
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
    switchMode("finance");
})();
