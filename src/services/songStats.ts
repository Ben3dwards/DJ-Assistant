import type { TrackRow } from "../helpers/scoreSimilarTracks.js";

function getAudioValue(
    audioAnalysis: { key: string; value: string }[],
    key: string
) {
    return audioAnalysis.find((item) => item.key === key)?.value;
}

export async function getSongStatsTrackData(
    spotifyId: string
): Promise<TrackRow | null> {
    const apiKey = process.env.SONGSTATS_API_KEY;

    if (!apiKey) {
        throw new Error("Missing Songstats API key.");
    }

    const params = new URLSearchParams({
        spotify_track_id: spotifyId,
    });

    const response = await fetch(
        `https://api.songstats.com/enterprise/v1/tracks/info?${params.toString()}`,
        {
            method: "GET",
            headers: {
                Accept: "application/json",
                apikey: apiKey,
            },
        }
    );

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Songstats request failed: ${response.status}`);
    }

    const data = await response.json();

    const trackInfo = data.track_info;
    const audioAnalysis = data.audio_analysis ?? [];

    if (!trackInfo || !audioAnalysis.length) {
        return null;
    }

    const danceability = Number(getAudioValue(audioAnalysis, "danceability"));
    const energy = Number(getAudioValue(audioAnalysis, "energy"));
    const tempo = Number(getAudioValue(audioAnalysis, "tempo"));
    const key_sig = getAudioValue(audioAnalysis, "key");
    const mode = Number(getAudioValue(audioAnalysis, "mode"));

    if (
        Number.isNaN(danceability) ||
        Number.isNaN(energy) ||
        Number.isNaN(tempo) ||
        !key_sig ||
        Number.isNaN(mode)
    ) {
        return null;
    }

    const spotifyLink = trackInfo.links?.find(
        (link: any) => link.source === "spotify"
    );

    return {
        spotifyID: spotifyId,
        track_name: trackInfo.title,
        track_artists: trackInfo.artists
            ?.map((artist: any) => artist.name)
            .join(", "),
        genres: trackInfo.genres?.join(", ") ?? "",
        release_date: trackInfo.release_date,
        danceability,
        key_sig,
        mode: mode === 1 ? 1 : 0,
        tempo,
        energy,
        spotify_URL:
            spotifyLink?.url ?? `https://open.spotify.com/track/${spotifyId}`,
    };
}