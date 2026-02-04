import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, LayoutTemplate, Search, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import bibleService, { VerseMatch } from "../services/bible";
import coversService, { SermonCover } from "../services/covers";
import { useLiveContext } from "../contexts/LiveContext";
import { useBackendContext } from "../contexts/BackendContext";
import { Books } from '../utils/bibleBooks';
import { buildLegacyCoverDoc } from "../utils/coverDesign";
import type { CoverDocument } from "../types/cover-design";
import CoverThumbnail from "./cover/CoverThumbnail";
import AccordionSection from "./ui/accordion-section";
import { normalizeCoverDoc } from "../services/mediaUrls";

interface Verse {
    index: number;
    text: string;
}

interface Chapter {
    name: string;
    research: string;
    verses: Verse[];
}

interface RecentSearch {
    id: string;
    bookKey: string;
    chapter: number;
    verseStart?: number;
    verseEnd?: number;
    label: string;
}

type SuggestionItem =
    | { id: string; type: 'recent'; label: string; search: RecentSearch }
    | { id: string; type: 'book'; label: string; bookKey: string }
    | { id: string; type: 'match'; label: string; bookKey: string; chapter: number; verse: number; snippet: string }
    | {
        id: string;
        type: 'reference';
        label: string;
        bookKey: string;
        chapter: number;
        verseStart?: number;
        verseEnd?: number;
    };

type QueryKind = 'empty' | 'reference' | 'book' | 'keyword';

const MAX_RECENTS = 6;

const normalizeText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const normalizeBook = (value: string) => normalizeText(value).replace(/[\s-]+/g, '');

const resolveBookKey = (input: string) => {
    const normalizedInput = normalizeBook(input);
    if (!normalizedInput) return '';

    const entries = Object.entries(Books);
    const exact = entries.find(([key, label]) =>
        normalizeBook(label) === normalizedInput || normalizeBook(key) === normalizedInput
    );
    if (exact) return exact[0];

    const partial = entries.find(([key, label]) =>
        normalizeBook(label).startsWith(normalizedInput) || normalizeBook(key).startsWith(normalizedInput)
    );

    return partial ? partial[0] : '';
};

const buildSearchLabel = (bookKey: string, chapter: number, verseStart?: number, verseEnd?: number) => {
    const bookLabel = Books[bookKey] || bookKey;
    if (verseStart && verseEnd && verseStart !== verseEnd) {
        return `${bookLabel} ${chapter}:${verseStart}-${verseEnd}`;
    }
    if (verseStart) {
        return `${bookLabel} ${chapter}:${verseStart}`;
    }
    return `${bookLabel} ${chapter}`;
};

const buildOffsetLimit = (verseStart?: number, verseEnd?: number) => {
    if (!verseStart || verseStart <= 0) {
        return { offset: 0, limit: 0, start: undefined as number | undefined, end: undefined as number | undefined };
    }

    let start = verseStart;
    let end = verseEnd && verseEnd > 0 ? verseEnd : verseStart;

    if (end < start) {
        [start, end] = [end, start];
    }

    const limit = end - (start - 1);
    return { offset: start, limit, start, end };
};

const extractBookPart = (query: string) => {
    const trimmed = query.trim();
    const bookRegex = /^(\d*\s*[A-Za-zñÑáéíóúÁÉÍÓÚ-]+)/i;
    const match = trimmed.match(bookRegex);
    return match ? match[0].trim() : '';
};

const bookOnlyPattern = /^\s*\d*\s*[A-Za-zñÑáéíóúÁÉÍÓÚ-]+\s*$/;
const referencePattern = /^\s*(\d*\s*[A-Za-zñÑáéíóúÁÉÍÓÚ-]+)\s+(\d+)(?::(\d+)?(?:-(\d+)?)?)?\s*$/;

const buildMatchLabel = (match: VerseMatch) => {
    const bookLabel = Books[match.book] || match.book;
    return `${bookLabel} ${match.chapter}:${match.verse}`;
};

const buildSnippet = (text: string, maxLength: number = 120) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
};

const isCoverDocument = (value: unknown): value is CoverDocument => {
    if (!value || typeof value !== "object") return false;
    const doc = value as CoverDocument;
    return !!doc.canvas && Array.isArray(doc.layers);
};

const getCoverDoc = (cover: SermonCover): CoverDocument => {
    let design: unknown = cover.design;
    if (typeof design === "string") {
        try {
            design = JSON.parse(design) as unknown;
        } catch {
            design = undefined;
        }
    }
    const base: CoverDocument = isCoverDocument(design)
        ? design
        : buildLegacyCoverDoc(cover);

    if (cover.background && base.canvas.background.type !== "image") {
        return {
            ...base,
            canvas: {
                ...base.canvas,
                background: {
                    type: "image" as const,
                    src: cover.background,
                    fit: "cover" as const,
                    opacity: 1,
                    positionX: 50,
                    positionY: 50,
                    scale: 1,
                    blur: 0,
                    vignette: 0,
                    overlayColor: cover.settings?.backgroundTint ?? "#000000",
                    overlayOpacity: 0.6,
                },
            },
        };
    }

    return base;
};

const BibleSearch: React.FC = () => {
    const { isConnected, sendScene, versePrefs } = useLiveContext();
    const { origin } = useBackendContext();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
    const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
    const [matchSuggestions, setMatchSuggestions] = useState<VerseMatch[]>([]);
    const [matchQuery, setMatchQuery] = useState('');
    const [isSearchingMatches, setIsSearchingMatches] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [dropdownMode, setDropdownMode] = useState<'recent' | 'suggestions'>('recent');
    const [coverLibrary, setCoverLibrary] = useState<SermonCover[]>([]);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const blurTimeoutRef = useRef<number | null>(null);
    const matchRequestRef = useRef(0);

    useEffect(() => {
        coversService
            .listCovers()
            .then(async (list) => {
                const details = await Promise.all(
                    list.map((item) => coversService.getCover(item.id).catch(() => null))
                );
                const filtered = details.filter((item): item is SermonCover => !!item)
                    .filter((item) => item.settings?.showInBible);
                setCoverLibrary(filtered);
            })
            .catch(() => setCoverLibrary([]));
    }, []);

    const sendVerseSelection = useCallback((chapter: Chapter, verse: Verse, forceLive?: boolean) => {
        const selectedVerse = {
            reference: `${chapter.name}:${verse.index}`,
            text: verse.text,
        };
        sendScene(
            {
                type: "verse",
                payload: {
                    ...selectedVerse,
                    background: versePrefs.background,
                    layout: versePrefs.layout,
                    showText: versePrefs.showText,
                    showReference: versePrefs.showReference,
                    mediaState: versePrefs.mediaState,
                },
                meta: { title: selectedVerse.reference, sourceModule: "search" },
                styles: versePrefs.styles,
            },
            { forceLive: !!forceLive }
        );
    }, [sendScene, versePrefs]);

    const handleSendCover = useCallback(
        (cover: SermonCover) => {
            const doc = cover.design ?? buildLegacyCoverDoc(cover);
            sendScene(
                {
                    type: "cover",
                    payload: { doc },
                    meta: { title: cover.title, sourceModule: "search" },
                },
                { forceLive: true }
            );
        },
        [sendScene]
    );

    const handleNextVerse = useCallback(() => {
        if (selectedChapter && selectedChapter.verses.length > 0) {
            setCurrentVerseIndex((prevIndex) => {
                const nextIndex = prevIndex + 1;
                return nextIndex < selectedChapter.verses.length ? nextIndex : prevIndex;
            });
        }
    }, [selectedChapter]);

    const handlePreviousVerse = useCallback(() => {
        if (selectedChapter && selectedChapter.verses.length > 0) {
            setCurrentVerseIndex((prevIndex) => {
                const nextIndex = prevIndex - 1;
                return nextIndex >= 0 ? nextIndex : prevIndex;
            });
        }
    }, [selectedChapter]);

    const queryInfo = useMemo(() => {
        const trimmed = searchQuery.trim();
        if (!trimmed) {
            return { kind: 'empty' as QueryKind, bookKey: '', reference: null as null | { chapter: number; verseStart?: number; verseEnd?: number } };
        }

        const referenceMatch = trimmed.match(referencePattern);
        if (referenceMatch) {
            const bookKey = resolveBookKey(referenceMatch[1]);
            const chapterValue = parseInt(referenceMatch[2], 10);
            if (bookKey && !Number.isNaN(chapterValue) && chapterValue > 0) {
                const verseStart = referenceMatch[3] ? parseInt(referenceMatch[3], 10) : undefined;
                const verseEnd = referenceMatch[4] ? parseInt(referenceMatch[4], 10) : undefined;
                return {
                    kind: 'reference' as QueryKind,
                    bookKey,
                    reference: {
                        chapter: chapterValue,
                        verseStart: Number.isNaN(verseStart) ? undefined : verseStart,
                        verseEnd: Number.isNaN(verseEnd) ? undefined : verseEnd
                    }
                };
            }
        }

        const bookMatch = trimmed.match(bookOnlyPattern);
        if (bookMatch) {
            const bookKey = resolveBookKey(bookMatch[0]);
            if (bookKey) {
                return { kind: 'book' as QueryKind, bookKey, reference: null };
            }
        }

        return { kind: 'keyword' as QueryKind, bookKey: '', reference: null };
    }, [searchQuery]);

    const persistRecentSearch = useCallback((search: RecentSearch) => {
        setRecentSearches(prev => {
            const next = [search, ...prev.filter(item => item.id !== search.id)].slice(0, MAX_RECENTS);
            return next;
        });
    }, []);

    const executeSearch = useCallback(async (bookKey: string, chapter: number, verseStart?: number, verseEnd?: number) => {
        setIsLoading(true);
        setError(null);

        try {
            const { start, end } = buildOffsetLimit(verseStart, verseEnd);
            const searchResult = await bibleService.getChapter(bookKey, chapter, 1, 0, 0);
            const targetIndex = start && start > 0
                ? Math.min(start - 1, Math.max(searchResult.verses.length - 1, 0))
                : 0;

            setSelectedChapter(searchResult);
            setCurrentVerseIndex(targetIndex);

            const recent = {
                id: `${bookKey}:${chapter}:${start ?? ''}-${end ?? ''}`,
                bookKey,
                chapter,
                verseStart: start,
                verseEnd: end,
                label: buildSearchLabel(bookKey, chapter, start, end)
            };
            setSearchQuery(recent.label);
            persistRecentSearch(recent);

        } catch (err) {
            setError('Error al obtener los versículos. Por favor, intenta de nuevo.');
            console.error('Error fetching verses:', err);
        } finally {
            setIsLoading(false);
        }
    }, [persistRecentSearch, sendVerseSelection]);

    const executeSearchFromQuery = useCallback(async () => {
        const trimmed = searchQuery.trim();
        if (!trimmed) {
            setError('Escribe una búsqueda para continuar.');
            return;
        }
        setError(null);

        const referenceMatch = trimmed.match(referencePattern);
        if (referenceMatch) {
            const bookKey = resolveBookKey(referenceMatch[1]);
            const chapterValue = parseInt(referenceMatch[2], 10);
            if (bookKey && !Number.isNaN(chapterValue) && chapterValue > 0) {
                const verseStart = referenceMatch[3] ? parseInt(referenceMatch[3], 10) : undefined;
                const verseEnd = referenceMatch[4] ? parseInt(referenceMatch[4], 10) : undefined;
                executeSearch(
                    bookKey,
                    chapterValue,
                    Number.isNaN(verseStart) ? undefined : verseStart,
                    Number.isNaN(verseEnd) ? undefined : verseEnd
                );
                return;
            }
        }

        if (queryInfo.kind === 'book') {
            setError('Agrega el capítulo para buscar (ej. Génesis 3).');
            return;
        }

        if (trimmed.length < 3) {
            setError('Escribe al menos 3 letras para buscar palabras.');
            return;
        }

        try {
            if (queryInfo.kind === 'keyword' && matchSuggestions.length > 0 && matchQuery === trimmed) {
                const first = matchSuggestions[0];
                executeSearch(first.book, first.chapter, first.verse, first.verse);
                return;
            }
            const matches = await bibleService.searchVerses(trimmed, 1, 1);
            if (matches.length === 0) {
                setError('No encontramos versículos con esas palabras.');
                return;
            }
            const first = matches[0];
            executeSearch(first.book, first.chapter, first.verse, first.verse);
        } catch (err) {
            console.error('Error searching verses:', err);
            setError('Error al buscar palabras. Intenta de nuevo.');
        }
    }, [searchQuery, executeSearch, queryInfo.kind, matchSuggestions, matchQuery]);

    const handleSearchSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        void executeSearchFromQuery();
        setIsDropdownOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
    }, [executeSearchFromQuery]);

    const handleRepeatLast = useCallback(() => {
        if (recentSearches.length < 2) return;
        const previous = recentSearches[1];
        setSearchQuery(previous.label);
        executeSearch(previous.bookKey, previous.chapter, previous.verseStart, previous.verseEnd);
        setIsDropdownOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
    }, [recentSearches, executeSearch]);

    const bookPart = useMemo(() => extractBookPart(searchQuery), [searchQuery]);
    const normalizedQuery = useMemo(() => normalizeBook(bookPart), [bookPart]);
    const bookSuggestions = useMemo(() => {
        if (queryInfo.kind !== 'book' || !normalizedQuery) return [] as { key: string; label: string }[];

        return Object.entries(Books)
            .map(([key, label]) => ({ key, label }))
            .filter(({ key, label }) => {
                const normalizedLabel = normalizeBook(label);
                const normalizedKey = normalizeBook(key);
                return normalizedLabel.includes(normalizedQuery) || normalizedKey.includes(normalizedQuery);
            })
            .slice(0, 8);
    }, [normalizedQuery, queryInfo.kind]);

    useEffect(() => {
        if (!isDropdownOpen || dropdownMode !== 'suggestions' || queryInfo.kind !== 'keyword') {
            setMatchSuggestions([]);
            setMatchQuery('');
            setIsSearchingMatches(false);
            return;
        }

        const trimmed = searchQuery.trim();
        if (trimmed.length < 3) {
            setMatchSuggestions([]);
            setMatchQuery('');
            setIsSearchingMatches(false);
            return;
        }

        const handle = window.setTimeout(() => {
            const requestId = ++matchRequestRef.current;
            setIsSearchingMatches(true);
            bibleService.searchVerses(trimmed, 1, 6)
                .then((results) => {
                    if (requestId !== matchRequestRef.current) return;
                    setMatchSuggestions(results);
                    setMatchQuery(trimmed);
                })
                .catch(() => {
                    if (requestId !== matchRequestRef.current) return;
                    setMatchSuggestions([]);
                    setMatchQuery(trimmed);
                })
                .finally(() => {
                    if (requestId !== matchRequestRef.current) return;
                    setIsSearchingMatches(false);
                });
        }, 250);

        return () => window.clearTimeout(handle);
    }, [searchQuery, dropdownMode, queryInfo.kind, isDropdownOpen]);

    const dropdownItems = useMemo<SuggestionItem[]>(() => {
        if (!isDropdownOpen) return [];
        if (dropdownMode === 'recent') {
            return recentSearches.map((search) => ({
                id: `recent-${search.id}`,
                type: 'recent' as const,
                label: search.label,
                search
            }));
        }
        const items: SuggestionItem[] = [];

        if (queryInfo.kind === 'reference' && queryInfo.reference) {
            const { chapter, verseStart, verseEnd } = queryInfo.reference;
            items.push({
                id: `reference-${queryInfo.bookKey}-${chapter}-${verseStart ?? ''}-${verseEnd ?? ''}`,
                type: 'reference' as const,
                label: buildSearchLabel(queryInfo.bookKey, chapter, verseStart, verseEnd),
                bookKey: queryInfo.bookKey,
                chapter,
                verseStart,
                verseEnd
            });
        }

        if (queryInfo.kind === 'keyword') {
            items.push(...matchSuggestions.map((match) => ({
                id: `match-${match.book}-${match.chapter}-${match.verse}`,
                type: 'match' as const,
                label: buildMatchLabel(match),
                bookKey: match.book,
                chapter: match.chapter,
                verse: match.verse,
                snippet: buildSnippet(match.text)
            })));
        }

        if (queryInfo.kind === 'book') {
            items.push(...bookSuggestions.map((suggestion) => ({
                id: `book-${suggestion.key}`,
                type: 'book' as const,
                label: suggestion.label,
                bookKey: suggestion.key
            })));
        }

        return items;
    }, [isDropdownOpen, dropdownMode, recentSearches, matchSuggestions, bookSuggestions, queryInfo]);

    useEffect(() => {
        if (activeIndex >= dropdownItems.length) {
            setActiveIndex(-1);
        }
    }, [activeIndex, dropdownItems.length]);

    const handleSelectItem = useCallback((item: SuggestionItem) => {
        if (item.type === 'recent') {
            setSearchQuery(item.label);
            executeSearch(item.search.bookKey, item.search.chapter, item.search.verseStart, item.search.verseEnd);
            setIsDropdownOpen(false);
            setActiveIndex(-1);
            inputRef.current?.blur();
            return;
        }

        if (item.type === 'reference') {
            setSearchQuery(item.label);
            executeSearch(item.bookKey, item.chapter, item.verseStart, item.verseEnd);
            setIsDropdownOpen(false);
            setActiveIndex(-1);
            inputRef.current?.blur();
            return;
        }

        if (item.type === 'match') {
            setSearchQuery(item.label);
            executeSearch(item.bookKey, item.chapter, item.verse, item.verse);
            setIsDropdownOpen(false);
            setActiveIndex(-1);
            inputRef.current?.blur();
            return;
        }

        setSearchQuery(`${item.label} `);
        setIsDropdownOpen(false);
        setActiveIndex(-1);
        window.requestAnimationFrame(() => {
            inputRef.current?.focus();
            const length = inputRef.current?.value.length ?? 0;
            inputRef.current?.setSelectionRange(length, length);
        });
    }, [executeSearch]);

    const handleInputFocus = useCallback(() => {
        if (blurTimeoutRef.current !== null) {
            window.clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setIsDropdownOpen(true);
        setDropdownMode('recent');
    }, []);

    const handleInputBlur = useCallback(() => {
        blurTimeoutRef.current = window.setTimeout(() => {
            setIsDropdownOpen(false);
            setActiveIndex(-1);
        }, 150);
    }, []);

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value;
        setSearchQuery(nextValue);
        setError(null);
        setMatchSuggestions([]);
        setMatchQuery('');
        setIsDropdownOpen(true);
        setActiveIndex(-1);
        setDropdownMode(nextValue.trim() ? 'suggestions' : 'recent');
    }, []);

    const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isDropdownOpen || dropdownItems.length === 0) {
            if (event.key === 'Enter') {
                event.preventDefault();
                void executeSearchFromQuery();
                setIsDropdownOpen(false);
                setActiveIndex(-1);
                inputRef.current?.blur();
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((prev) => (prev + 1) % dropdownItems.length);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((prev) => (prev <= 0 ? dropdownItems.length - 1 : prev - 1));
            return;
        }

        if (event.key === 'Enter') {
            if (activeIndex >= 0 && dropdownItems[activeIndex]) {
                event.preventDefault();
                handleSelectItem(dropdownItems[activeIndex]);
                return;
            }
            event.preventDefault();
            void executeSearchFromQuery();
            setIsDropdownOpen(false);
            setActiveIndex(-1);
            inputRef.current?.blur();
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            setIsDropdownOpen(false);
            setActiveIndex(-1);
        }
    }, [isDropdownOpen, dropdownItems, activeIndex, handleSelectItem, executeSearchFromQuery]);

    const showRecents = isDropdownOpen && dropdownMode === 'recent' && recentSearches.length > 0;
    const showMatches = isDropdownOpen && dropdownMode === 'suggestions' && queryInfo.kind === 'keyword' && dropdownItems.length > 0;
    const trimmedQuery = searchQuery.trim();
    const showNoMatches = isDropdownOpen
        && dropdownMode === 'suggestions'
        && queryInfo.kind === 'keyword'
        && trimmedQuery.length >= 3
        && !isSearchingMatches
        && matchSuggestions.length === 0;
    const previousSearch = recentSearches.length > 1 ? recentSearches[1] : null;
    const repeatLabel = previousSearch ? previousSearch.label : 'Volver al anterior';
    const hasVerses = !!selectedChapter?.verses?.length;
    const currentVerse = hasVerses ? selectedChapter.verses[currentVerseIndex] : null;

    return (
        <Card className="w-full glass-panel flex flex-col h-[640px]">
            <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-2xl font-semibold">Búsqueda inteligente</CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-6 min-h-0">
                <form onSubmit={handleSearchSubmit} className="relative z-20 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/90 px-3 py-2 shadow-sm">
                            <Search className="h-4 w-4 text-slate-400" />
                            <Input
                                ref={inputRef}
                                type="text"
                                placeholder='Ej. Juan 3:16 o escribe "jesus lloro"'
                                value={searchQuery}
                                onFocus={handleInputFocus}
                                onBlur={handleInputBlur}
                                onChange={handleInputChange}
                                onKeyDown={handleInputKeyDown}
                                className="h-8 border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                            />
                            </div>
                            {isDropdownOpen && (dropdownItems.length > 0 || isSearchingMatches || showNoMatches) && (
                                <div className="absolute z-40 mt-3 w-full rounded-2xl border border-white/70 bg-white/95 shadow-xl">
                                    {showRecents && (
                                        <p className="px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">Recientes</p>
                                    )}
                                    {showMatches && (
                                        <p className="px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">Coincidencias</p>
                                    )}
                                    {showNoMatches && (
                                        <p className="px-4 py-3 text-sm text-slate-400">No encontramos coincidencias.</p>
                                    )}
                                    {isSearchingMatches && queryInfo.kind === 'keyword' && dropdownItems.length === 0 && (
                                        <p className="px-4 py-3 text-sm text-slate-400">Buscando...</p>
                                    )}
                                    <ul className="max-h-64 overflow-auto">
                                        {dropdownItems.map((item, index) => (
                                            <li
                                                key={item.id}
                                                className={`cursor-pointer px-4 py-3 text-sm flex items-start justify-between gap-3 ${
                                                    index === activeIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                                                }`}
                                                onMouseDown={() => handleSelectItem(item)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={item.type === 'match' ? 'font-medium' : ''}>{item.label}</span>
                                                    {item.type === 'match' && (
                                                        <span className="text-xs text-slate-500">{item.snippet}</span>
                                                    )}
                                                </div>
                                                {item.type === 'book' && (
                                                    <span className="text-xs text-slate-400">Libro</span>
                                                )}
                                                {item.type === 'reference' && (
                                                    <span className="text-xs text-slate-400">
                                                        {item.verseStart ? 'Versículo' : 'Capítulo'}
                                                    </span>
                                                )}
                                                {item.type === 'match' && (
                                                    <span className="text-xs text-slate-400">Versículo</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRepeatLast}
                            disabled={!previousSearch}
                        >
                            {repeatLabel}
                        </Button>
                        <Button
                            type="submit"
                            className="bg-slate-900 text-white hover:bg-slate-800"
                        >
                            <Search className="h-4 w-4 mr-2" />
                            Buscar
                        </Button>
                </form>

                {isLoading && <p className="text-sm text-slate-500">Cargando versículos...</p>}
                {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

                <div className="flex flex-1 flex-col gap-4 min-h-0">
                    <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                        {coverLibrary.length > 0 && (
                            <AccordionSection
                                title="Portadas"
                                icon={<LayoutTemplate className="h-4 w-4" />}
                            >
                                <div className="max-h-[220px] overflow-y-auto pr-1">
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                        {coverLibrary.map((cover) => {
                                            const doc = getCoverDoc(cover);
                                            const normalizedDoc = origin ? normalizeCoverDoc(doc, origin) : doc;
                                            const aspectRatio = normalizedDoc.canvas.width / normalizedDoc.canvas.height;
                                            return (
                                                <button
                                                    key={cover.id}
                                                    type="button"
                                                    onClick={() => handleSendCover(cover)}
                                                    className="group relative w-full overflow-hidden rounded-xl border border-white/70 bg-white/70 text-left hover:bg-white"
                                                    title={cover.title}
                                                    aria-label={`Enviar portada ${cover.title}`}
                                                >
                                                    <div
                                                        className="relative w-full overflow-hidden rounded-lg bg-black"
                                                        style={{ aspectRatio }}
                                                    >
                                                        <CoverThumbnail
                                                            doc={normalizedDoc}
                                                            className="h-full w-full"
                                                        />
                                                    </div>
                                                    <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                                                        {cover.title}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </AccordionSection>
                        )}

                        <div className="relative w-full min-h-[220px] max-h-[280px] aspect-[4/3] overflow-hidden rounded-xl bg-black p-3">
                            <div className="relative flex h-full w-full items-center justify-center px-4 py-6 text-center">
                                <AnimatePresence mode="wait">
                                    {currentVerse && selectedChapter ? (
                                        <motion.div
                                            key={`${selectedChapter.name}-${currentVerse.index}`}
                                            className="max-w-xl text-white"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.25 }}
                                        >
                                            <p className="text-[10px] uppercase tracking-[0.3em] text-white/70">
                                                {selectedChapter.name}:{currentVerse.index}
                                            </p>
                                            <p className="mt-4 text-lg font-medium leading-relaxed text-white">
                                                {currentVerse.text}
                                            </p>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="empty"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <p className="rounded-2xl bg-black/40 px-6 py-3 text-sm text-white/70">
                                                {isLoading
                                                    ? "Cargando versículos..."
                                                    : error
                                                        ? "No hay resultados todavía."
                                                        : "Busca un pasaje o escribe palabras clave."}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="absolute bottom-4 left-4 right-4">
                                <Button
                                    onClick={() => {
                                        if (selectedChapter && currentVerse) {
                                            sendVerseSelection(selectedChapter, currentVerse, true);
                                        }
                                    }}
                                    className="w-full flex items-center justify-center"
                                    variant="outline"
                                    disabled={!isConnected || !currentVerse}
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    {!isConnected ? 'Sin conexión' : 'Enviar a pantalla externa'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between">
                        <Button
                            onClick={handlePreviousVerse}
                            className="flex items-center"
                            disabled={!hasVerses || currentVerseIndex === 0}
                        >
                            <ChevronLeft className="mr-2"/> Anterior
                        </Button>
                        <Button
                            onClick={handleNextVerse}
                            className="flex items-center"
                            disabled={!hasVerses || currentVerseIndex === (selectedChapter?.verses.length ?? 0) - 1}
                        >
                            Siguiente <ChevronRight className="ml-2"/>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default React.memo(BibleSearch);
