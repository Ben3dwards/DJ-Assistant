import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { DJMcpClient } from "./mcpClient.js";
import { db } from "./db/connect_db.js";
import { loadSessionState, saveSessionState } from "./state/sessionStorage.js";

dotenv.config({ quiet: true });

const app = express();
const port = Number(process.env.PORT ?? 3000);

const mcpClient = new DJMcpClient();
await mcpClient.connectToServer();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Navigate from build/ up to the project root to find the client folder
const projectRoot = path.join(__dirname, "..");
const clientPath = path.join(projectRoot, "client");

app.use(express.json());
app.use(express.static(clientPath));

//Home page
app.get("/", (_req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
});

//Tracks page
app.get("/tracks", (_req, res) => {
    res.sendFile(path.join(clientPath, "tracks.html"));
});

//About page
app.get("/about", (_req, res) => {
    res.sendFile(path.join(clientPath, "about.html"));
});

// Returns all tracks from the database ordered by artist and track name
app.get("/api/tracks", async (_req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                spotifyID,
                track_name,
                track_artists,
                genres,
                release_date,
                danceability,
                key_sig,
                mode,
                tempo,
                energy,
                spotify_URL
            FROM tracks
            ORDER BY track_artists ASC, track_name ASC
        `);

        res.json(rows);
    } catch (error) {
        console.error("Failed to load tracks:", error);
        res.status(500).json({ error: "Failed to load tracks." });
    }
});

//Receives a chat message and returns a reply from the MCP client
app.post("/api/chat", async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required." });
        }

        const reply = await mcpClient.processQuery(message);

        res.json({ reply });
    } catch (error) {
        console.error("Chat request failed:", error);
        res.status(500).json({ error: "Chat request failed." });
    }
});

//Redirects the user to Spotify's OAuth authorisation page
app.get("/auth/spotify", (_req, res) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return res.status(500).send("Spotify OAuth is not configured.");
    }

    const scopes = [
        "playlist-modify-private",
        "user-read-private",
        "user-read-email",
    ].join(" ");

    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        scope: scopes,
        redirect_uri: redirectUri,
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

//Handles the Spotify OAuth callback - exchanges the code for an access token
app.get("/auth/spotify/callback", async (req, res) => {
    try {
        const code = req.query.code;

        if (typeof code !== "string") {
            return res.status(400).send("Missing Spotify code.");
        }

        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            return res.status(500).send("Spotify OAuth is not configured.");
        }

        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

        const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            console.error(await tokenResponse.text());
            return res.status(500).send("Spotify token exchange failed.");
        }

        const tokenData = await tokenResponse.json();

        const profileResponse = await fetch("https://api.spotify.com/v1/me", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        if (!profileResponse.ok) {
            console.error(await profileResponse.text());
            return res.status(500).send("Could not load Spotify profile.");
        }

        const profile = await profileResponse.json();

        const state = loadSessionState();

        state.spotifySession = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + tokenData.expires_in * 1000,
            displayName: profile.display_name ?? "Spotify user",
        };

        saveSessionState(state);

        res.redirect("/");
    } catch (error) {
        console.error("Spotify callback failed:", error);
        res.status(500).send("Spotify login failed.");
    }
});

//Returns the current Spotify login status
app.get("/api/spotify/status", (_req, res) => {
    const state = loadSessionState();

    if (!state.spotifySession) {
        return res.json({ loggedIn: false });
    }

    res.json({
        loggedIn: true,
        displayName: state.spotifySession.displayName,
    });
});

//Clears the Spotify session
app.post("/auth/spotify/logout", (_req, res) => {
    const state = loadSessionState();

    state.spotifySession = null;

    saveSessionState(state);

    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`Web server running at http://localhost:${port}`);
});