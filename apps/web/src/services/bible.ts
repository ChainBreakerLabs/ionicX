import axios from 'axios';
import {
    getApiBibleSearchUrl,
    getApiBibleUrl,
    getApiShutdownUrl,
    getApiUploadImageUrl,
    getApiUploadUrl,
} from './endpoints';
import { getBackendOrigin } from './backend';
import { ensureAbsoluteUrl } from './mediaUrls';

interface Verse {
    index: number;
    text: string;
}

interface Chapter {
    name: string;
    research: string;
    verses: Verse[];
}

export interface VerseMatch {
    book: string;
    chapter: number;
    verse: number;
    text: string;
}

export const bibleService = {
    getChapter: async (book: string, chapter: number, version: number, offset: number = 0, limit: number = 0): Promise<Chapter> => {
        try {
            const apiBibleUrl = await getApiBibleUrl();
            const adjustedOffset = offset >= 1 ? offset - 1 : offset;
            const response = await axios.get<Chapter>(`${apiBibleUrl}/${book}/${chapter}`, {
                params: { version, offset: adjustedOffset, limit },
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });

            console.log('Response:', response.data);

            const chapterData: Chapter = {
                name: response.data.name,
                research: response.data.research,
                verses: response.data.verses,
            };


            if (!chapterData.name || !Array.isArray(chapterData.verses)) {
                throw new Error('Invalid chapter data received from server');
            }

            return chapterData;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Axios error:', error.response?.data || error.message);
                throw new Error(`Failed to fetch chapter: ${error.message}`);
            } else {
                console.error('Error fetching chapter:', error);
                throw new Error('An unexpected error occurred while fetching the chapter');
            }
        }
    },
    searchVerses: async (query: string, version: number = 1, limit: number = 6): Promise<VerseMatch[]> => {
        try {
            const searchUrl = await getApiBibleSearchUrl();
            const response = await axios.get<VerseMatch[]>(searchUrl, {
                params: { q: query, version, limit },
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });

            if (!Array.isArray(response.data)) {
                throw new Error('Invalid search data received from server');
            }

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Axios error:', error.response?.data || error.message);
                throw new Error(`Failed to search verses: ${error.message}`);
            } else {
                console.error('Error searching verses:', error);
                throw new Error('An unexpected error occurred while searching verses');
            }
        }
    },

    uploadVideo: async (videoFile: File, onProgress?: (progress: number) => void): Promise<string> => {
        const formData = new FormData();
        formData.append('video', videoFile);

        try {
            const uploadUrl = await getApiUploadUrl();
            const response = await axios.post(uploadUrl, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        if (onProgress) {
                            onProgress(percentCompleted);
                        }
                    }
                },
            });

            if (response.status !== 200) {
                throw new Error('Upload failed');
            }

            const origin = await getBackendOrigin();
            return ensureAbsoluteUrl(response.data.url, origin) ?? response.data.url;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(`Upload failed: ${error.response.data.error || error.message}`);
            } else {
                throw new Error('An unexpected error occurred during upload');
            }
        }
    },
    uploadImage: async (imageFile: File, onProgress?: (progress: number) => void): Promise<string> => {
        const formData = new FormData();
        formData.append('image', imageFile);

        try {
            const uploadUrl = await getApiUploadImageUrl();
            const response = await axios.post(uploadUrl, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json',
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        if (onProgress) {
                            onProgress(percentCompleted);
                        }
                    }
                },
            });

            if (response.status !== 200) {
                throw new Error('Upload failed');
            }

            const origin = await getBackendOrigin();
            return ensureAbsoluteUrl(response.data.url, origin) ?? response.data.url;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(`Upload failed: ${error.response.data.error || error.message}`);
            } else {
                throw new Error('An unexpected error occurred during upload');
            }
        }
    },
    shutdownApp: async (): Promise<void> => {
        const shutdownUrl = await getApiShutdownUrl();
        await axios.post(shutdownUrl);
    },
};

export default bibleService;
