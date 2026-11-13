import { db } from "../db/connect_db.js";
import { scoreSimilarTracks, type TrackRow } from "./scoreSimilarTracks.js";
import { toCamelot } from "./camelotConversion.js";
import { loadSessionState, saveSessionState } from "../state/sessionStorage.js";

export type GenerateSetlistInput = {
    startTrackName?: string;
    startSpotifyID?: string;
    artist?: string;
    length?: number;
};

export async function generateSetlistFromSeed(input: GenerateSetlistInput) {
    const setlistLength = input.length ?? 10;

    //Build lookup for the first track in the setlist
    const where: string[] = [];
    const values: any[] = [];

    if (input.startSpotifyID) {
        where.push("spotifyID = ?");
        values.push(input.startSpotifyID);
    }

    if (input.startTrackName) {
        where.push("track_name LIKE ?");
        values.push(`%${input.startTrackName}%`);
    }

    if (input.artist) {
        where.push("track_artists LIKE ?");
        values.push(`%${input.artist}%`);
    }

    if (!where.length) {
        throw new Error("Please provide a starting track name or Spotify ID.");
    }

    //Find the starting track
    const [startRows] = await db.execute(
        `
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
        WHERE ${where.join(" AND ")}
        LIMIT 1
        `,
        values
    );

    const startTracks = startRows as TrackRow[];

    if (!startTracks.length) {
        throw new Error("Starting track was not found in the local database.");
    }

    const startTrack = startTracks[0]!;

    // Tracks already chosen should not appear again
    const usedSpotifyIDs = new Set<string>();
    usedSpotifyIDs.add(startTrack.spotifyID);

    const setlist: TrackRow[] = [startTrack];

    let currentTrack = startTrack;

    // Keep adding tracks until requested length is reached
    while (setlist.length < setlistLength) {
        const referenceYear = new Date(currentTrack.release_date).getFullYear();

        //Keep recommendations in the same broad DnB era
        const minYear = referenceYear - 4;
        const maxYear = referenceYear + 4;

        // Get possible next tracks
        const [candidateRows] = await db.execute(
            `
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
            WHERE spotifyID != ?
                AND YEAR(release_date) BETWEEN ? AND ?
            LIMIT 500
            `,
            [currentTrack.spotifyID, minYear, maxYear]
        );

        const candidates = candidateRows as TrackRow[];

        // Score candidates against the current track
        const scoredTracks = scoreSimilarTracks(currentTrack, candidates).filter(
            (track) => !usedSpotifyIDs.has(track.spotifyID)
        );

        //If there are no usable candidates, stop early
        if (!scoredTracks.length) {
            break;
        }

        //Randomise from the top 5 candidates to avoid identical setlists (iteration 7)
        const topCandidates = scoredTracks.slice(0, 5);
        const randomIndex = Math.floor(Math.random() * topCandidates.length);
        const nextTrack = topCandidates[randomIndex]!;

        setlist.push(nextTrack);
        usedSpotifyIDs.add(nextTrack.spotifyID);

        //The next track becomes the new reference track
        currentTrack = nextTrack;
    }

    const result = {
        setlist: setlist.map((track, index) => ({
            position: index + 1,
            spotifyID: track.spotifyID,
            name: track.track_name,
            artists: track.track_artists,
            releaseDate: track.release_date,
            key: track.key_sig,
            mode: track.mode === 1 ? "major" : "minor",
            camelot: toCamelot(track.key_sig, track.mode),
            tempo: track.tempo,
            energy: track.energy,
            danceability: track.danceability,
            spotifyUrl: track.spotify_URL,
        })),
    };

    const state = loadSessionState();

    state.latestSetlist = {
        tracks: result.setlist.map((track) => ({
            spotifyID: track.spotifyID,
            name: track.name,
            artists: track.artists,
            spotifyUrl: track.spotifyUrl,
        })),
    };

    saveSessionState(state);

    //MCP documentation recommends console.error for server-side logging
    //as console.log writes to stdout which is reserved for the MCP stdio protocol
    console.error("Session updated:", state.latestSetlist.tracks.length, "tracks, first track:", state.latestSetlist.tracks[0]?.name);

    return result;
}