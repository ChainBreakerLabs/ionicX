import axios from "axios";
import { getApiLyricsUrl } from "./endpoints";

export interface LyricsSegment {
    id: string;
    title: string;
    content: string;
    kind: string;
    color: string;
}

export interface LyricsSettings {
    fontFamily: string;
    fontSize: number;
    textColor: string;
    backgroundColor: string;
    align: "left" | "center" | "right";
    highlightColor?: string;
}

export interface LyricsSong {
    id: string;
    title: string;
    lyrics: string;
    segments: LyricsSegment[];
    settings: LyricsSettings;
    createdAt: string;
    updatedAt: string;
}

export interface LyricsSongSummary {
    id: string;
    title: string;
    updatedAt: string;
}

export interface LyricsSongPayload {
    id?: string;
    title: string;
    lyrics: string;
    segments: LyricsSegment[];
    settings: LyricsSettings;
}

const lyricsService = {
    listSongs: async (): Promise<LyricsSongSummary[]> => {
        const lyricsUrl = await getApiLyricsUrl();
        const response = await axios.get<LyricsSongSummary[]>(lyricsUrl);
        return response.data;
    },
    getSong: async (id: string): Promise<LyricsSong> => {
        const lyricsUrl = await getApiLyricsUrl();
        const response = await axios.get<LyricsSong>(`${lyricsUrl}/${id}`);
        return response.data;
    },
    saveSong: async (payload: LyricsSongPayload): Promise<LyricsSong> => {
        const lyricsUrl = await getApiLyricsUrl();
        const response = await axios.post<LyricsSong>(lyricsUrl, payload);
        return response.data;
    },
    deleteSong: async (id: string): Promise<void> => {
        const lyricsUrl = await getApiLyricsUrl();
        await axios.delete(`${lyricsUrl}/${id}`);
    },
};

export default lyricsService;
