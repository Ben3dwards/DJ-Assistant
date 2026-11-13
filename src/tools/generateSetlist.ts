import { z } from "zod";
import { generateSetlistFromSeed } from "../helpers/generateSetlistFromSeed.js";

export const generateSetlistInputSchema = {
    startTrackName: z.string().optional(),
    startSpotifyID: z.string().optional(),
    artist: z.string().optional(),
    length: z.number().int().min(2).max(25).optional(),
};

export const generateSetlistDescription = `
Generate a drum and bass setlist starting from a reference track.

Use this when the user asks to:
- create a setlist
- build a playlist
- make a sequence of tracks
- find tracks to play after a starting track

The tool starts with the requested track, then repeatedly finds the next best track
based on harmonic compatibility, energy, danceability, tempo, and release era.

The model should provide:
- startTrackName or startSpotifyID
- artist if the track name could be ambiguous
- length if the user asks for a specific number of tracks

When presenting the setlist:
- format the response clearly using markdown
- include track position
- include artist names
- include release year
- include musical key
- include Camelot notation
- include BPM / tempo
- include Spotify links when available

Prefer markdown tables for setlists.

Example:
"I want a 10 track setlist starting with Mr Happy"
`;

export type GenerateSetlistToolInput = {
    startTrackName?: string;
    startSpotifyID?: string;
    artist?: string;
    length?: number;
};

export async function generateSetlist(input: GenerateSetlistToolInput) {
    try {
        //Generate the setlist using the helper
        const result = await generateSetlistFromSeed(input);

        //Return the setlist to Claude via the MCP client
        return {
            content: [
                {
                    type: "text" as const,
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    } catch (error) {
        return {
            content: [
                {
                    type: "text" as const,
                    text:
                        error instanceof Error
                            ? error.message
                            : "Something went wrong while generating the setlist.",
                },
            ],
        };
    }
}