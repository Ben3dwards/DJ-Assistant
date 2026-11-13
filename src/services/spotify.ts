let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getSpotifyAccessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Missing Spotify API credentials.");
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });

    if (!response.ok) {
        throw new Error(`Spotify auth failed: ${response.status}`);
    }

    const data = await response.json();

    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000;

    return cachedToken;
}

export async function searchSpotifyTrack(trackName: string, artist?: string) {
    const token = await getSpotifyAccessToken();

    const query = artist
        ? `track:${trackName} artist:${artist}`
        : `track:${trackName}`;

    const params = new URLSearchParams({
        q: query,
        type: "track",
        limit: "1",
    });

    const response = await fetch(
        `https://api.spotify.com/v1/search?${params.toString()}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Spotify search failed: ${response.status}`);
    }

    const data = await response.json();
    const track = data.tracks?.items?.[0];

    if (!track) {
        return null;
    }

    return {
        spotifyId: track.id,
        name: track.name,
        artists: track.artists.map((artist: any) => artist.name).join(", "),
        releaseDate: track.album?.release_date,
        spotifyUrl: track.external_urls?.spotify,
    };
}