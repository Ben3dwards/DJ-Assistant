import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("messages");
const spotifyButton = document.getElementById("spotify-button");

async function loadSpotifyStatus() {
    const response = await fetch("/api/spotify/status");
    const data = await response.json();

    if (data.loggedIn) {
        spotifyButton.textContent = `Hi ${data.displayName}`;
        spotifyButton.onclick = async () => {
            await fetch("/auth/spotify/logout", { method: "POST" });
            window.location.reload();
        };
    } else {
        spotifyButton.textContent = "Connect Spotify";
        spotifyButton.onclick = () => {
            window.location.href = "/auth/spotify";
        };
    }
}

loadSpotifyStatus();

function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.innerHTML = marked.parse(text);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function setLoading(loading) {
    input.disabled = loading;
    form.querySelector("button").disabled = loading;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message) return;

    addMessage("user", message);
    input.value = "";
    setLoading(true);

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message }),
        });

        const data = await response.json();

        addMessage("assistant", data.reply);
    } catch (error) {
        console.error(error);
        addMessage("assistant", "Something went wrong while contacting the server.");
    } finally {
        setLoading(false);
    }
});