import {
  appendChat,
  connectRoom,
  createSyncedPlayer,
} from "./player.js";

const setup = document.getElementById("setup");
const live = document.getElementById("live");
const hostStatus = document.getElementById("host-status");
const createBtn = document.getElementById("create-room");
const roomCode = document.getElementById("room-code");
const joinLink = document.getElementById("join-link");
const listenerCount = document.getElementById("listener-count");
const results = document.getElementById("results");
const queueEl = document.getElementById("queue");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const chat = document.getElementById("chat");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const playerContainer = document.getElementById("player");

/** @type {Array<{videoId:string,title:string,thumbnail:string}>} */
let queue = [];
let room = null;
let player = null;
let socket = null;
let displayName = "host";
let booted = false;

function setStatus(text, isError = false) {
  if (!hostStatus) return;
  hostStatus.textContent = text;
  hostStatus.classList.toggle("error", isError);
}

createBtn?.addEventListener("click", async () => {
  await createRoom();
});

async function createRoom() {
  setStatus("creating room…");
  createBtn.disabled = true;
  const res = await fetch("/api/rooms", { method: "POST" });
  if (!res.ok) {
    createBtn.disabled = false;
    const data = await res.json().catch(() => ({}));
    const err = data.error ?? (res.status === 401 ? "unauthorized" : "room_create_failed");
    const detail = data.detail ? ` (${data.detail})` : "";
    setStatus(`could not create room (${err}${detail})`, true);
    if (createBtn) createBtn.hidden = false;
    return;
  }
  const data = await res.json();
  await startRoom(data);
}

async function startRoom({ code, joinUrl }) {
  setup.hidden = true;
  live.hidden = false;
  setStatus("");
  roomCode.textContent = code;
  joinLink.href = joinUrl;
  joinLink.textContent = joinUrl;

  player = await createSyncedPlayer(playerContainer, {
    onTick: (playback) => {
      socket?.send({ type: "playback", playback });
    },
  });

  socket = connectRoom({
    code,
    role: "host",
    onMessage: (msg) => {
      if (msg.type === "state") {
        room = msg.room;
        listenerCount.textContent = String(msg.room.listeners);
        if (msg.room.queue?.length) {
          queue = msg.room.queue;
          renderQueue();
        }
      }
      if (msg.type === "chat") {
        appendChat(chat, msg);
      }
    },
  });

  setInterval(() => player?.tick(), 1000);
}

searchForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;
  setStatus("searching…");
  const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`);
  const data = await res.json().catch(() => ({}));
  results.innerHTML = "";
  if (!res.ok) {
    const err = data.error ?? (res.status === 401 ? "unauthorized" : "search_failed");
    setStatus(`search failed (${err}) — try signing in again`, true);
    return;
  }
  setStatus("");
  if (!data.items?.length) {
    setStatus("no results — try another query");
    return;
  }
  for (const item of data.items) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "result";
    row.innerHTML = `<img src="${item.thumbnail}" alt="" /><span>${item.title}</span><span class="tag">play</span>`;
    row.addEventListener("click", () => playItem(item));
    results.appendChild(row);
  }
});

function playItem(item) {
  queue = [item, ...queue.filter((q) => q.videoId !== item.videoId)].slice(
    0,
    20,
  );
  renderQueue();
  player?.play(item);
  socket?.send({ type: "queue", queue });
}

function renderQueue() {
  queueEl.innerHTML = "";
  for (const item of queue) {
    const row = document.createElement("div");
    row.className = "result";
    row.innerHTML = `<img src="${item.thumbnail}" alt="" /><span>${item.title}</span>`;
    row.addEventListener("click", () => playItem(item));
    queueEl.appendChild(row);
  }
}

chatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket?.send({ type: "chat", text, name: displayName });
  appendChat(chat, { name: displayName, text });
  chatInput.value = "";
});

async function boot() {
  if (booted) return;
  booted = true;
  setStatus("loading session…");

  const me = await fetch("/api/me");
  if (!me.ok) {
    setStatus("session expired — sign in again", true);
    return;
  }
  const profile = await me.json();
  displayName = profile.name || "host";

  setStatus("checking room…");
  const active = await fetch("/api/rooms/active");
  if (active.ok) {
    const data = await active.json();
    await startRoom(data);
    return;
  }

  await createRoom();
}

boot();
