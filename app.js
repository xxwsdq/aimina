
/* Agent Mina v0.3 — chat + Android Bridge */
"use strict";

(() => {
  const WORKER_DEFAULT = "https://ai-video-brain.tolasovalihan9.workers.dev";
  const API_PATH = "/ai/test";
  const CHAT_KEY = "agent_mina_chats_v01";
  const WORKER_KEY = "agent_mina_worker_url_v01";

  const MINA_SYSTEM = `Ты — Agent Mina, личный ИИ-помощник пользователя.
Твоё имя — Мина. Никогда не называй себя Gemma.
Общайся на русском языке, дружелюбно, естественно и живо.
Используй женский грамматический род, когда говоришь о себе.
Отвечай кратко, если задача простая; подробно — если пользователь просит.
Ты можешь передавать Android-команды только через доступные инструменты сайта.
Не утверждай, что действие выполнено, пока приложение не подтвердило результат.
Не выдумывай результаты и не проси пароли или секретные токены.

Доступная команда Android в этой версии:
- открыть ibis Paint X.

Если пользователь просит открыть ibis Paint X, сообщи, что отправляешь команду.
Если просит другое действие на телефоне, честно объясни, что оно пока не подключено.`;

  const $ = id => document.getElementById(id);

  const state = {
    chats: loadChats(),
    activeChatId: null,
    busy: false,
    token: "",
    workerUrl: localStorage.getItem(WORKER_KEY) || WORKER_DEFAULT
  };

  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function loadChats() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.filter(c => c && Array.isArray(c.messages))
        : [];
    } catch {
      return [];
    }
  }

  function saveChats() {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(state.chats));
    } catch {
      toast("Не удалось сохранить историю: память браузера заполнена.");
    }
  }

  function activeChat() {
    return state.chats.find(c => c.id === state.activeChatId) || null;
  }

  function createChat() {
    const chat = {
      id: id(),
      title: "Новый разговор",
      updatedAt: new Date().toISOString(),
      messages: []
    };

    state.chats.unshift(chat);
    state.activeChatId = chat.id;
    saveChats();
    renderChat();
    $("topbarTitle").textContent = chat.title;
    showPage("chat");
    $("messageInput").focus();
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function showPage(name) {
    const ids = {
      chat: "chatPage",
      history: "historyPage",
      tools: "toolsPage",
      settings: "settingsPage"
    };

    Object.entries(ids).forEach(([key, value]) => {
      $(value).classList.toggle("active", key === name);
    });

    document.querySelectorAll("[data-page]").forEach(b => {
      b.classList.toggle("active", b.dataset.page === name);
    });

    $("topbarTitle").textContent = ({
      chat: "Новый разговор",
      history: "История",
      tools: "Возможности",
      settings: "Настройки"
    })[name];

    if (name === "history") renderHistory();
    closeSidebar();
  }

  function openSidebar() {
    $("sidebar").classList.add("open");
    $("scrim").classList.add("show");
  }

  function closeSidebar() {
    $("sidebar").classList.remove("open");
    $("scrim").classList.remove("show");
  }

  function addMessage(role, content, save = true) {
    const chat = activeChat();
    if (!chat) return;

    chat.messages.push({
      role,
      content: String(content),
      at: new Date().toISOString()
    });

    chat.updatedAt = new Date().toISOString();

    if (role === "user" && chat.title === "Новый разговор") {
      chat.title = String(content).replace(/\s+/g, " ").slice(0, 46) || "Новый разговор";
      $("topbarTitle").textContent = chat.title;
    }

    if (save) saveChats();
    renderMessages();
  }

  function renderChat() {
    if (!activeChat()) {
      if (state.chats.length) {
        state.activeChatId = state.chats[0].id;
      } else {
        createChat();
        return;
      }
    }

    renderMessages();
    $("topbarTitle").textContent = activeChat().title;
  }

  function renderMessages() {
    const chat = activeChat();
    const welcome = $("welcome");
    const root = $("messages");
    const messages = chat ? chat.messages : [];

    welcome.hidden = messages.length > 0;
    root.innerHTML = "";

    messages.forEach(m => {
      const article = document.createElement("article");
      article.className = "message " + (m.role === "user" ? "user" : "assistant");

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = m.role === "user" ? "Я" : "M";

      const body = document.createElement("div");
      const meta = document.createElement("div");
      meta.className = "message-meta";
      meta.textContent = m.role === "user" ? "Ты" : "Мина";

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = m.content;

      body.append(meta, bubble);
      article.append(avatar, body);
      root.append(article);
    });

    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      $("chatScroll").scrollTop = $("chatScroll").scrollHeight;
    });
  }

  function showTyping() {
    const article = document.createElement("article");
    article.className = "message assistant";
    article.id = "typingIndicator";

    article.innerHTML =
      '<div class="avatar">M</div><div><div class="message-meta">Мина думает</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div></div>';

    $("messages").append(article);
    scrollToBottom();
  }

  function removeTyping() {
    $("typingIndicator")?.remove();
  }

  function extractText(payload) {
    let value = payload;

    if (value && Object.prototype.hasOwnProperty.call(value, "result")) {
      value = value.result;
    }

    const choiceText = value?.choices?.[0]?.message?.content;
    if (typeof choiceText === "string") return choiceText.trim();

    if (typeof value === "string") return value.trim();
    if (typeof value?.response === "string") return value.response.trim();
    if (typeof value?.message?.content === "string") return value.message.content.trim();
    if (typeof value?.content === "string") return value.content.trim();

    if (Array.isArray(value?.content)) {
      return value.content
        .map(item => typeof item?.text === "string" ? item.text : "")
        .filter(Boolean)
        .join("\n")
        .trim();
    }

    return "";
  }

  function getToken() {
    if (state.token) return state.token;

    const token = window.prompt(
      "Введи STUDIO_TOKEN для доступа к своему Cloudflare Worker. Не отправляй его в чат."
    );

    if (!token || !token.trim()) return "";

    state.token = token.trim();
    return state.token;
  }

  function setBusy(busy) {
    state.busy = busy;
    $("sendButton").disabled = busy;
    $("messageInput").disabled = busy;
    $("sendButton").querySelector("span").textContent = busy ? "Думаю…" : "Отправить";
    $("connectionLabel").textContent = busy ? "Мина думает…" : "Готова к работе";
  }

  // Распознавание команды открытия ibis Paint X.
  // Русские границы слов обрабатываются без \b.
  function detectAndroidCommand(text) {
    const normalized = text
      .toLowerCase()
      .replace(/ё/g, "е")
      .trim();

    const asksToOpen =
      /(^|[^а-яa-z0-9])(открой|запусти|включи)(?=$|[^а-яa-z0-9])/.test(normalized);

    const mentionsIbis =
      /ibis\s*paint/.test(normalized) ||
      normalized.includes("ибис пэйнт") ||
      normalized.includes("ибис паинт") ||
      normalized.includes("ибис");

    if (asksToOpen && mentionsIbis) {
      return "open_ibis";
    }

    return null;
  }

  function sendAndroidCommand(action) {
    if (action !== "open_ibis") return false;

    toast("Передаю команду Android Bridge…");

    // Запуск Bridge. Подтверждение выполняется внутри Android-приложения.
    window.location.href = "mina://launch?action=open_ibis";
    return true;
  }

  async function sendMessage(textValue) {
    const text = String(textValue || $("messageInput").value).trim();
    if (!text || state.busy) return;

    if (!activeChat()) createChat();

    $("messageInput").value = "";
    resizeInput();
    addMessage("user", text);

    // Сначала проверяем Android-команду.
    // Если команда распознана, Gemma вообще не вызывается.
    const command = detectAndroidCommand(text);

    if (command) {
      addMessage(
        "assistant",
        "Поняла! Передаю команду на открытие ibis Paint X. Подтверди запуск в приложении Mina Android Bridge."
      );

      sendAndroidCommand(command);
      return;
    }

    const token = getToken();

    if (!token) {
      addMessage(
        "assistant",
        "Мне нужен STUDIO_TOKEN, чтобы подключиться к серверу. Его можно ввести в настройках подключения."
      );
      return;
    }

    setBusy(true);
    showTyping();

    try {
      const chat = activeChat();

      const history = chat.messages.slice(-12).map(m =>
        `${m.role === "user" ? "Пользователь" : "Мина"}: ${m.content}`
      ).join("\n\n");

      const prompt =
        `${MINA_SYSTEM}\n\nИстория разговора:\n${history}\n\nОтветь на последнее сообщение пользователя.`;

      const url = state.workerUrl.replace(/\/+$/, "") + API_PATH;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ prompt: prompt.slice(0, 12000) })
      });

      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        state.token = "";
        throw new Error("Токен не подошёл. Проверь STUDIO_TOKEN в настройках.");
      }

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.message || payload.error || `Ошибка сервера: ${response.status}`
        );
      }

      const answer = extractText(payload);
      if (!answer) {
        throw new Error("Сервер не вернул текстовый ответ. Проверь формат ответа Worker.");
      }

      removeTyping();
      addMessage("assistant", answer);

    } catch (error) {
      removeTyping();
      addMessage(
        "assistant",
        "Не получилось связаться с сервером: " +
        (error.message || "неизвестная ошибка") +
        "\n\nПроверь интернет, адрес Worker и токен в настройках."
      );
    } finally {
      removeTyping();
      setBusy(false);
      $("messageInput").focus();
    }
  }

  function resizeInput() {
    const el = $("messageInput");
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }

  function renderHistory() {
    const root = $("historyList");
    root.innerHTML = "";

    if (!state.chats.length) {
      root.innerHTML =
        '<div class="settings-card"><p class="field-help">История пока пуста. Напиши Мине первое сообщение.</p></div>';
      return;
    }

    state.chats.forEach(chat => {
      const item = document.createElement("div");
      item.className = "history-item";

      const icon = document.createElement("div");
      icon.className = "avatar";
      icon.textContent = "◷";

      const name = document.createElement("div");
      name.className = "history-name";

      const title = document.createElement("b");
      title.textContent = chat.title;

      const sub = document.createElement("small");
      sub.textContent =
        `${chat.messages.length} сообщений · ${new Date(chat.updatedAt).toLocaleString("ru-RU")}`;

      name.append(title, sub);

      const open = document.createElement("button");
      open.textContent = "Открыть";

      open.addEventListener("click", () => {
        state.activeChatId = chat.id;
        renderChat();
        showPage("chat");
      });

      item.append(icon, name, open);
      root.append(item);
    });
  }

  async function testConnection() {
    const status = $("connectionStatus");
    const url = $("workerUrl").value.trim().replace(/\/+$/, "");
    const token = $("studioToken").value.trim() || state.token;

    if (!url || !/^https:\/\/[^ ]+/i.test(url)) {
      status.textContent = "Укажи HTTPS-адрес Worker";
      return;
    }

    if (!token) {
      status.textContent = "Введи STUDIO_TOKEN";
      return;
    }

    status.textContent = "Проверяю…";
    state.workerUrl = url;
    state.token = token;
    localStorage.setItem(WORKER_KEY, url);

    try {
      const response = await fetch(url + API_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          prompt: MINA_SYSTEM +
            "\n\nОтветь одной короткой фразой: связь работает, представься Миной."
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.message || payload.error || `HTTP ${response.status}`
        );
      }

      status.textContent = "Подключение работает ✓";
      $("connectionLabel").textContent = "Сервер доступен";
      toast("Мина подключилась к Worker");

    } catch (error) {
      status.textContent = "Ошибка: " + error.message;
    }
  }

  function exportChats() {
    const blob = new Blob(
      [JSON.stringify(state.chats, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agent-mina-history.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Экспорт истории подготовлен");
  }

  function clearChats() {
    if (!confirm("Удалить всю историю разговоров на этом устройстве?")) return;

    state.chats = [];
    state.activeChatId = null;
    saveChats();
    createChat();
    renderHistory();
    toast("История очищена");
  }

  $("sendButton").addEventListener("click", () => sendMessage());
  $("messageInput").addEventListener("input", resizeInput);

  $("messageInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  $("newChat").addEventListener("click", createChat);
  $("menuButton").addEventListener("click", openSidebar);
  $("closeSidebar").addEventListener("click", closeSidebar);
  $("scrim").addEventListener("click", closeSidebar);

  document.querySelectorAll("[data-page]").forEach(b => {
    b.addEventListener("click", () => showPage(b.dataset.page));
  });

  document.querySelectorAll("[data-prompt]").forEach(b => {
    b.addEventListener("click", () => sendMessage(b.dataset.prompt));
  });

  $("workerUrl").value = state.workerUrl;
  $("testConnection").addEventListener("click", testConnection);
  $("exportChats").addEventListener("click", exportChats);
  $("clearChats").addEventListener("click", clearChats);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(err =>
        console.warn("PWA cache unavailable", err)
      );
    });
  }

  renderChat();
})();
        
