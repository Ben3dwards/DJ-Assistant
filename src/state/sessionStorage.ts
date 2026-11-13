import fs from "fs";
import path from "path";
import type { SessionState } from "./sessionState.js";

const sessionFile = path.resolve("data/session.json");

export function loadSessionState(): SessionState {
    if (!fs.existsSync(sessionFile)) {
        return {
            spotifySession: null,
            latestSetlist: null,
        };
    }

    return JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
}

export function saveSessionState(state: SessionState) {
    fs.writeFileSync(sessionFile, JSON.stringify(state, null, 2));
}