document.getElementById("create-room-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch("/translate/api/rooms", { method: "POST" });
  if (!response.ok) {
    alert("Could not create the meeting. Please try again.");
    return;
  }

  const { room_id: roomId, join_token: joinToken } = await response.json();
  window.location.href = `/translate/rooms/${roomId}#${joinToken}`;
});
