import { startMicrophone, stopMicrophone } from "./microphone.js";

const appElement = document.getElementById("app");
const roomId = appElement.dataset.roomId;
const joinToken = window.location.hash.slice(1);

const statusMessages = {
  invalid_message: "Something went wrong. Please refresh.",
  room_full: "This meeting already has 3 participants.",
  room_not_found: "This meeting link is no longer valid.",
  microphone_unavailable: "Microphone access is unavailable.",
  recognition_available: "Speech recognition is back online.",
  recognition_unavailable: "Speech recognition is unavailable. You can type captions manually.",
  translation_unavailable: "Translation failed for the last caption.",
  reconnecting: "Reconnecting to speech recognition...",
};

function renderApp() {
  appElement.innerHTML = `
    <div id="status" role="status"></div>
    <ul id="participants"></ul>
    <ul id="captions"></ul>
    <form id="manual-caption-form">
      <input id="manual-caption-text" maxlength="2000" placeholder="Type a caption">
      <button type="submit">Send</button>
    </form>
    <button id="mic-toggle">Start speaking</button>
  `;
}

function showStatus(code) {
  const statusElement = document.getElementById("status");
  statusElement.textContent = statusMessages[code] ?? "";
}

function renderParticipants(participants) {
  const list = document.getElementById("participants");
  list.innerHTML = "";
  for (const participant of participants) {
    const item = document.createElement("li");
    item.textContent = participant.display_name;
    list.appendChild(item);
  }
}

function upsertCaption(caption) {
  const list = document.getElementById("captions");
  let item = document.getElementById(`caption-${caption.id}`);
  if (!item) {
    item = document.createElement("li");
    item.id = `caption-${caption.id}`;
    list.appendChild(item);
  }

  const text = caption.state === "final" ? caption.translated_text : caption.source_text;
  item.textContent = `${caption.speaker.display_name}: ${text ?? "..."}`;

  if (caption.state !== "translating") {
    const clarifyButton = document.createElement("button");
    clarifyButton.textContent = "Ask to clarify";
    clarifyButton.addEventListener("click", () => {
      socket.send(JSON.stringify({ type: "clarification_request", caption_id: caption.id }));
    });
    item.appendChild(clarifyButton);
  }
}

renderApp();

let micActive = false;
document.getElementById("mic-toggle").addEventListener("click", async () => {
  if (micActive) {
    stopMicrophone();
    socket.send(JSON.stringify({ type: "audio_stop" }));
    micActive = false;
    return;
  }

  try {
    await startMicrophone((chunk) => socket.send(chunk));
    socket.send(JSON.stringify({ type: "audio_start" }));
    micActive = true;
  } catch {
    showStatus("microphone_unavailable");
  }
});

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(`${protocol}//${window.location.host}/translate/rooms/${roomId}/session`);

socket.addEventListener("open", () => {
  socket.send(
    JSON.stringify({
      type: "join",
      room_id: roomId,
      token: joinToken,
      display_name: window.prompt("Your display name") ?? "Guest",
      speech_language: "japanese",
      display_language: "english",
      consent: true,
    }),
  );
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  switch (message.type) {
    case "room_joined":
      renderParticipants(message.participants);
      break;
    case "participant_joined":
    case "participant_left":
      // TODO: Track membership incrementally after the core loop is confirmed.
      break;
    case "caption_preview":
      break;
    case "caption_update":
      upsertCaption(message.caption);
      break;
    case "clarification_requested":
      showStatus("reconnecting"); // TODO: Use a dedicated clarification-request UI slot.
      break;
    case "status":
      showStatus(message.code);
      break;
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "manual-caption-form") return;
  event.preventDefault();
  const input = document.getElementById("manual-caption-text");
  if (!input.value) return;
  socket.send(JSON.stringify({ type: "caption_manual", text: input.value }));
  input.value = "";
});
