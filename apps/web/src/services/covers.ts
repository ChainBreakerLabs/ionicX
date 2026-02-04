import axios from "axios";
import { getApiCoversUrl } from "./endpoints";
import type { CoverDocument } from "../types/cover-design";
import { getBackendOrigin } from "./backend";
import { ensureAbsoluteUrl, normalizeCoverDoc, stripBackendOrigin, stripCoverDoc } from "./mediaUrls";

export interface CoverSettings {
    fontFamily: string;
    titleColor: string;
    subtitleColor: string;
    accentColor: string;
    backgroundTint: string;
    titleSize: number;
    subtitleSize: number;
    align: "left" | "center" | "right";
    badgeLabel: string;
    imagePosX: number;
    imagePosY: number;
    imageScale: number;
    showInBible: boolean;
}

export interface SermonCover {
    id: string;
    title: string;
    subtitle: string;
    speaker: string;
    dateLabel: string;
    background: string;
    settings: CoverSettings;
    design?: CoverDocument;
    assets?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface SermonCoverSummary {
    id: string;
    title: string;
    updatedAt: string;
}

export interface SermonCoverPayload {
    id?: string;
    title: string;
    subtitle: string;
    speaker: string;
    dateLabel: string;
    background: string;
    settings: CoverSettings;
    design?: CoverDocument;
    assets?: string[];
}

const isCoverDocument = (value: unknown): value is CoverDocument => {
    if (!value || typeof value !== "object") return false;
    const doc = value as CoverDocument;
    return !!doc.canvas && Array.isArray(doc.layers);
};

const parseCoverDesign = (value: unknown): CoverDocument | undefined => {
    if (!value) return undefined;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value) as unknown;
            return isCoverDocument(parsed) ? parsed : undefined;
        } catch {
            return undefined;
        }
    }
    if (isCoverDocument(value)) return value;
    return undefined;
};

const coversService = {
    listCovers: async (): Promise<SermonCoverSummary[]> => {
        const coversUrl = await getApiCoversUrl();
        const response = await axios.get<SermonCoverSummary[]>(coversUrl);
        return response.data;
    },
    getCover: async (id: string): Promise<SermonCover> => {
        const coversUrl = await getApiCoversUrl();
        const response = await axios.get<SermonCover>(`${coversUrl}/${id}`);
        const origin = await getBackendOrigin();
        const cover = response.data;
        const parsedDesign = parseCoverDesign(cover.design);
        const normalizedBackground = ensureAbsoluteUrl(cover.background, origin) ?? cover.background;
        const normalizedDesign = parsedDesign ? normalizeCoverDoc(parsedDesign, origin) : undefined;
        return {
            ...cover,
            background: normalizedBackground,
            design: normalizedDesign,
        };
    },
    saveCover: async (payload: SermonCoverPayload): Promise<SermonCover> => {
        const coversUrl = await getApiCoversUrl();
        const origin = await getBackendOrigin();
        const parsedDesign = parseCoverDesign(payload.design);
        const normalizedPayload: SermonCoverPayload = {
            ...payload,
            background: stripBackendOrigin(payload.background, origin) ?? payload.background,
            design: parsedDesign ? stripCoverDoc(parsedDesign, origin) : payload.design,
            assets: payload.assets?.map((asset) => stripBackendOrigin(asset, origin) ?? asset),
        };
        const response = await axios.post<SermonCover>(coversUrl, normalizedPayload);
        return response.data;
    },
    deleteCover: async (id: string): Promise<void> => {
        const coversUrl = await getApiCoversUrl();
        await axios.delete(`${coversUrl}/${id}`);
    },
};

export default coversService;
