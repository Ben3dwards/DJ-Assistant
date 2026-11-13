import { z } from "zod";
import { db } from "../db/connect_db.js";
import { buildTrackSearch } from "../helpers/buildTrackSearch.js";
import type { TrackSearchInput } from "../helpers/buildTrackSearch.js";

export const searchTracksInputSchema = {
    trackName: z.string().optional(),
    artist: z.string().optional(),
    spotifyID: z.string().optional(),

    genreContains: z.array(z.string()).optional(),

    year: z.number().int().optional(),
    yearBefore: z.number().int().optional(),
    yearAfter: z.number().int().optional(),

    keySig: z.string().optional(),
    mode: z.union([z.literal(0), z.literal(1)]).optional(),

    tempoMin: z.number().optional(),
    tempoMax: z.number().optional(),

    danceabilityMin: z.number().min(0).max(1).optional(),
    danceabilityMax: z.number().min(0).max(1).optional(),

    energyMin: z.number().min(0).max(1).optional(),
    energyMax: z.number().min(0).max(1).optional(),

    limit: z.number().int().min(1).max(20).optional(),
};

export const searchTracksDescription = `
Search the local drum and bass track database.

Use this when the user asks for track recommendations based on:
- artist
- track name
- genre or subgenre
- release year
- BPM / tempo
- key
- mode
- danceability
- energy
- mood such as chill, liquid, dark, insane, jump up, jungle

The model should interpret natural language into filters.

Examples:
"chill liquid dnb" might use:
genreContains: ["liquid", "liquid funk", "drum and bass"]
energyMax: 0.75
tempoMin: 160
tempoMax: 180

"insane jump up before 2011" might use:
genreContains: ["jump up", "drum and bass"]
yearBefore: 2011
energyMin: 0.85
tempoMin: 170
`;

export async function searchTracks(input: TrackSearchInput) {
    // Convert the input filters into a parameterised SQL query
    const { sql, values } = buildTrackSearch(input);

    const [rows] = await db.execute(sql, values);

    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(rows, null, 2),
            },
        ],
    };
}