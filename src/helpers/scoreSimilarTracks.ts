import { toCamelot } from "./camelotConversion.js";
import { isCamelotCompatible } from "./camelotCompatibility.js";

export type TrackRow = {
    spotifyID: string;
    track_name: string;
    track_artists: string;
    genres: string;
    release_date: string;
    danceability: number;
    key_sig: string;
    mode: 0 | 1;
    tempo: number;
    energy: number;
    spotify_URL: string;
};

export function scoreSimilarTracks(referenceTrack: TrackRow, candidates: TrackRow[]) {
    //Convert reference track key/mode into Camelot notation
    const referenceCamelot = toCamelot(
        referenceTrack.key_sig,
        referenceTrack.mode
    );

    return candidates.filter((candidate) => candidate.spotifyID !== referenceTrack.spotifyID).map((candidate) => {
            //Convert candidate track key/mode into Camelot notation
            const candidateCamelot = toCamelot(
                candidate.key_sig,
                candidate.mode
            );

            //Harmonic mixing is most important
            const harmonicScore =
                referenceCamelot &&
                candidateCamelot &&
                isCamelotCompatible(referenceCamelot, candidateCamelot)
                    ? 1
                    : 0;

            //Closer energy = higher score
            const energyScore =
                1 - Math.abs(referenceTrack.energy - candidate.energy);

            //Closer danceability = higher score
            const danceabilityScore =
                1 - Math.abs(referenceTrack.danceability - candidate.danceability);

            //Closer tempo = higher score
            //Dividing by 20 means a 20 BPM difference scores very poorly
            const tempoScore =
                1 - Math.min(Math.abs(referenceTrack.tempo - candidate.tempo) / 20, 1);

            //Weighted total score - harmonic mixing matters most
            const totalScore =
                harmonicScore * 50 +
                energyScore * 25 +
                danceabilityScore * 15 +
                tempoScore * 10;

            return {
                ...candidate,
                camelot: candidateCamelot,
                similarity: {
                    totalScore,
                    harmonicScore,
                    energyScore,
                    danceabilityScore,
                    tempoScore,
                },
            };
        })
        .sort((a, b) => b.similarity.totalScore - a.similarity.totalScore);
}