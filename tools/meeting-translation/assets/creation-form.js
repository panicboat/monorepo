document.getElementById("create-room-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const displayName = document.getElementById("creation-display-name").value;
  const speechLanguage = document.getElementById("creation-speech-language").value;
  const displayLanguage = document.getElementById("creation-display-language").value;
  const consent = document.getElementById("creation-consent").checked;

  const response = await fetch("/translate/api/rooms", { method: "POST" });
  if (!response.ok) {
    alert("Could not create the meeting. Please try again.");
    return;
  }

  const { room_id: roomId, join_token: joinToken } = await response.json();
  // Carries the creator's own join settings to the room page so they don't retype them there.
  const params = new URLSearchParams({
    display_name: displayName,
    speech_language: speechLanguage,
    display_language: displayLanguage,
    consent: String(consent),
  });
  window.location.href = `/translate/rooms/${roomId}?${params}#${joinToken}`;
});
