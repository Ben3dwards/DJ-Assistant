export type SpotifySession = {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    displayName: string;
};

export type StoredSetlistTrack = {
    spotifyID: string;
    name: string;
    artists: string;
    spotifyUrl?: string;
};

export type StoredSetlist = {
    tracks: StoredSetlistTrack[];
};

export type SessionState = {
    spotifySession: SpotifySession | null;
    latestSetlist: StoredSetlist | null;
};

export const sessionState: SessionState = {
    spotifySession: null,
    latestSetlist: null,
};