import { z } from "zod";

import { db } from "../db/connect_db.js";
import {scoreSimilarTracks, type TrackRow,} from "../helpers/scoreSimilarTracks.js";
import { toCamelot } from "../helpers/camelotConversion.js";
import { searchSpotifyTrack } from "../services/spotify.js";
import { getSongStatsTrackData } from "../services/songStats.js";

export const recommendFromTrackInputSchema = {
    trackName: z.string().optional(),
    spotifyId: z.string().optional(),
    artist: z.string().optional(),
    limit: z.number().int().min(1).max(10).optional(),
};

export const recommendFromTrackDescription = `
Recommend drum and bass tracks that would mix well with a reference track.

Use this when the user asks for:
- tracks similar to another track
- what to play after a track
- what mixes well with a track
- recommendations based on a specific song

The model should provide either trackName or spotifyId.

This tool first searches the local database. If the reference track is not found,
it uses Spotify API to find the Spotify ID, then Songstats API to retrieve
audio analysis data.

This tool prioritises:
1. harmonic mixing / Camelot compatibility
2. similar energy
3. similar danceability
4. similar tempo

This tool returns release dates so the model can explain whether tracks are from a similar drum and bass era.
`;

export type RecommendFromTrackInput = {
    trackName?: string;
    spotifyId?: string;
    artist?: string;
    limit?: number;
};

export async function recommendFromTrack(input: RecommendFromTrackInput) {
    const limit = input.limit ?? 3;

    // Build the local database lookup query
    const where: string[] = [];
    const values: any[] = [];

    if (input.spotifyId) {
        where.push("spotifyID = ?");
        values.push(input.spotifyId);
    }

    if (input.trackName) {
        where.push("track_name LIKE ?");
        values.push(`%${input.trackName}%`);
    }

    if (input.artist) {
        where.push("track_artists LIKE ?");
        values.push(`%${input.artist}%`);
    }

    if (!where.length) {
        return {
            content: [
                {
                    type: "text" as const,
                    text: "Please provide either a track name or Spotify ID.",
                },
            ],
        };
    }

    // Try to find the reference track in the local database
    const [referenceRows] = await db.execute(
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

    const referenceTracks = referenceRows as TrackRow[];

    let referenceTrack: TrackRow;
    let referenceSource: "local_database" | "spotify_songstats" = "local_database";

    if (referenceTracks.length) {
        // Found locally — use database data directly
        referenceTrack = referenceTracks[0]!;
    } else {
        // Not found locally - fall back to Spotify and Songstats APIs
        if (!input.trackName && !input.spotifyId) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "I could not find that track locally, and I need a track name or Spotify ID to use the API fallback.",
                    },
                ],
            };
        }

        let spotifyId = input.spotifyId;

        //If the user gave a track name rather than a Spotify ID,
        if (!spotifyId && input.trackName) {
            const spotifyTrack = await searchSpotifyTrack(
                input.trackName,
                input.artist
            );

            if (!spotifyTrack) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "I could not find that track on Spotify.",
                        },
                    ],
                };
            }

            spotifyId = spotifyTrack.spotifyId;
        }

        if (!spotifyId) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "I could not resolve a Spotify ID for that track.",
                    },
                ],
            };
        }

        let songStatsTrack;

        try {
            songStatsTrack = await getSongStatsTrackData(spotifyId);
        } catch (err) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "I found the track on Spotify, but Songstats is currently unavailable. Please try again later.",
                    },
                ],
                isError: true,
            };
        }

        if (!songStatsTrack) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: "I found the track on Spotify, but Songstats does not have analysis data for it yet. Songstats may generate this data after the request, so please try again later.",
                    },
                ],
                isError: true,
            };
        }

        referenceTrack = songStatsTrack;
        referenceSource = "spotify_songstats";
    }

    //Create an era window based on the reference track's release date
    const referenceYear = new Date(referenceTrack.release_date).getFullYear();
    const minYear = referenceYear - 4;
    const maxYear = referenceYear + 4;

    //Get candidate tracks from the local database within the era window
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
        [referenceTrack.spotifyID, minYear, maxYear]
    );

    const candidates = candidateRows as TrackRow[];

    //Score candidates against the reference track and take the top results
    const scoredTracks = scoreSimilarTracks(referenceTrack, candidates).slice(0, limit);

    const referenceCamelot = toCamelot(referenceTrack.key_sig, referenceTrack.mode);

    //Return the reference track details alongside the recommendations
    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(
                    {
                        referenceSource,
                        eraWindow: {
                            minYear,
                            maxYear,
                        },
                        referenceTrack: {
                            spotifyId: referenceTrack.spotifyID,
                            name: referenceTrack.track_name,
                            artists: referenceTrack.track_artists,
                            releaseDate: referenceTrack.release_date,
                            key: referenceTrack.key_sig,
                            mode: referenceTrack.mode === 1 ? "major" : "minor",
                            camelot: referenceCamelot,
                            tempo: referenceTrack.tempo,
                            energy: referenceTrack.energy,
                            danceability: referenceTrack.danceability,
                            spotifyUrl: referenceTrack.spotify_URL,
                        },
                        recommendations: scoredTracks.map((track) => ({
                            spotifyId: track.spotifyID,
                            name: track.track_name,
                            artists: track.track_artists,
                            releaseDate: track.release_date,
                            camelot: track.camelot,
                            tempo: track.tempo,
                            energy: track.energy,
                            danceability: track.danceability,
                            spotifyUrl: track.spotify_URL,
                            score: Number(track.similarity.totalScore.toFixed(2)),
                            reason: {
                                harmonicMatch: track.similarity.harmonicScore === 1,
                                energySimilarity: Number(track.similarity.energyScore.toFixed(2)),
                                danceabilitySimilarity: Number(track.similarity.danceabilityScore.toFixed(2)),
                                tempoSimilarity: Number(track.similarity.tempoScore.toFixed(2)),
                            },
                        })),
                    },
                    null,
                    2
                ),
            },
        ],
    };
}