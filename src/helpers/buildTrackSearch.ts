//Define search filters
export type TrackSearchInput = {
    spotifyID?: string;
    trackName?: string;
    artist?: string;
    genreContains?: string[];
    year?: number;
    yearBefore?: number;
    yearAfter?: number;
    keySig?: string;
    mode?: 0 | 1;
    tempoMin?: number;
    tempoMax?: number;
    danceabilityMin?: number;
    danceabilityMax?: number;
    energyMin?: number;
    energyMax?: number;
    limit?: number;
};

export function buildTrackSearch(input: TrackSearchInput) {  
    //SQL query parameterised values to preventSQL injection
    const where: string[] = [];

    const values: any[] = [];

    if (input.spotifyID !== undefined) {
        where.push("spotifyID = ?");
        values.push(input.spotifyID);
    }

    if (input.trackName !== undefined) {
        where.push("track_name LIKE ?");
        values.push(`%${input.trackName}%`);
    }
    
    if (input.artist !== undefined) {
        where.push("track_artists LIKE ?");
        values.push(`%${input.artist}%`);
    }

    if (input.genreContains?.length) {
        where.push(`(${input.genreContains.map(() => "genres LIKE ?").join(" OR ")})`
    );

    for (const genre of input.genreContains) {
        values.push(`%${genre}%`);
    }
    }

    if (input.year !== undefined) {
        where.push("YEAR(release_date) = ?");
        values.push(input.year);
    }

    if (input.yearBefore !== undefined) {
        where.push("YEAR(release_date) < ?");
        values.push(input.yearBefore);
    }

    if (input.yearAfter !== undefined) {
        where.push("YEAR(release_date) > ?");
        values.push(input.yearAfter);
    }

    if (input.keySig !== undefined) {
        where.push("key_sig = ?");
        values.push(input.keySig);
    }

    if (input.mode !== undefined) {
        where.push("mode = ?");
        values.push(input.mode);
    }

    if (input.tempoMin !== undefined) {
        where.push("tempo >= ?");
        values.push(input.tempoMin);
    }

    if (input.tempoMax !== undefined) {
        where.push("tempo <= ?");
        values.push(input.tempoMax);
    }

    if (input.danceabilityMin !== undefined) {
        where.push("danceability >= ?");
        values.push(input.danceabilityMin);
    }

    if (input.danceabilityMax !== undefined) {
        where.push("danceability <= ?");
        values.push(input.danceabilityMax);
    }

    if (input.energyMin !== undefined) {
        where.push("energy >= ?");
        values.push(input.energyMin);
    }

    if (input.energyMax !== undefined) {
        where.push("energy <= ?");
        values.push(input.energyMax);
    }

    const limit = input.limit ?? 5;

 
    const sql = `
    SELECT
        spotifyID,
        track_name,
        track_artists,
        genres,
        duration,
        release_date,
        danceability,
        key_sig,
        mode,
        tempo,
        energy,
        spotify_URL
    FROM tracks
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY energy DESC, danceability DESC
    LIMIT ?
    `;

    values.push(limit);

    return { sql, values };
}