// input:  [NGA open-access image UUID pool, rate-limited random refresh state, image preloading, timed rotation, and tooltip primitives]
// output: [`AuthArtPanel` shared auth-page artwork showcase component]
// pos:    [Right-side auth-page visual panel that rotates one randomly chosen NGA painting at a time with classic Ken Burns motion, compact citation, and guarded refresh access]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, RefreshCw } from 'lucide-react';

import { NGA_OPEN_ACCESS_IMAGE_POOL, type NgaOpenAccessImageEntry } from '@/assets/ngaOpenAccessImagePool';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

const buildIiifAsset = (entry: NgaOpenAccessImageEntry) => ({
    alt: 'Open-access artwork from the National Gallery of Art collection.',
    src: `https://api.nga.gov/iiif/${entry.uuid}/full/!1200,1600/0/default.jpg`,
    srcSet: [
        `https://api.nga.gov/iiif/${entry.uuid}/full/!640,960/0/default.jpg 640w`,
        `https://api.nga.gov/iiif/${entry.uuid}/full/!960,1280/0/default.jpg 960w`,
        `https://api.nga.gov/iiif/${entry.uuid}/full/!1200,1600/0/default.jpg 1200w`,
    ].join(', '),
    artworkLine: `${entry.title} by ${entry.artist}`,
    sourceLine: 'Source: National Gallery of Art Open Data, open-access IIIF image.',
});

const REFRESH_COOLDOWN_MS = 3000;
const AUTO_ROTATE_MS = 36000;

const getRandomArtworkEntry = (excludeUuid?: string) => {
    if (NGA_OPEN_ACCESS_IMAGE_POOL.length <= 1) {
        return NGA_OPEN_ACCESS_IMAGE_POOL[0];
    }

    let nextEntry = NGA_OPEN_ACCESS_IMAGE_POOL[Math.floor(Math.random() * NGA_OPEN_ACCESS_IMAGE_POOL.length)];
    while (nextEntry.uuid === excludeUuid) {
        nextEntry = NGA_OPEN_ACCESS_IMAGE_POOL[Math.floor(Math.random() * NGA_OPEN_ACCESS_IMAGE_POOL.length)];
    }
    return nextEntry;
};

export const AuthArtPanel: React.FC = () => {
    const [selectedEntry, setSelectedEntry] = useState(() => getRandomArtworkEntry());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const lastRefreshAtRef = useRef(0);
    const selectedArtwork = useMemo(() => buildIiifAsset(selectedEntry), [selectedEntry]);

    const switchToEntry = useCallback((nextEntry: NgaOpenAccessImageEntry, markCooldown: boolean) => {
        const preloadImage = new Image();
        setIsRefreshing(true);
        preloadImage.decoding = 'async';
        preloadImage.src = buildIiifAsset(nextEntry).src;
        preloadImage.onload = () => {
            if (markCooldown) {
                lastRefreshAtRef.current = Date.now();
            }
            setSelectedEntry(nextEntry);
            setIsRefreshing(false);
        };
        preloadImage.onerror = () => {
            if (markCooldown) {
                lastRefreshAtRef.current = Date.now();
            }
            setIsRefreshing(false);
        };
    }, []);

    const rotateArtwork = useCallback((markCooldown: boolean) => {
        if (isRefreshing) {
            return;
        }
        switchToEntry(getRandomArtworkEntry(selectedEntry.uuid), markCooldown);
    }, [isRefreshing, selectedEntry.uuid, switchToEntry]);

    const handleRefresh = () => {
        const now = Date.now();
        if (isRefreshing || now - lastRefreshAtRef.current < REFRESH_COOLDOWN_MS) {
            return;
        }
        rotateArtwork(true);
    };

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            rotateArtwork(false);
        }, AUTO_ROTATE_MS);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [rotateArtwork]);

    return (
        <div className="relative hidden overflow-hidden bg-[#14110f] lg:block">
            <AnimatePresence mode="sync">
                <motion.img
                    key={selectedEntry.uuid}
                    src={selectedArtwork.src}
                    srcSet={selectedArtwork.srcSet}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    alt={selectedArtwork.alt}
                    className="absolute max-w-none object-cover"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="auto"
                    style={{
                        width: '140%',
                        height: '140%',
                        left: 0,
                        top: 0,
                        transformOrigin: 'center center',
                    }}
                    initial={{ opacity: 0, x: '-4%', y: '-2%', scale: 1.1 }}
                    animate={{
                        opacity: 1,
                        x: '-22%',
                        y: '-16%',
                        scale: 1.28,
                    }}
                    exit={{ opacity: 0, scale: 1.18 }}
                    transition={{
                        opacity: { duration: 0.65, ease: 'easeOut' },
                        x: { duration: AUTO_ROTATE_MS / 1000, ease: 'easeInOut' },
                        y: { duration: AUTO_ROTATE_MS / 1000, ease: 'easeInOut' },
                        scale: { duration: AUTO_ROTATE_MS / 1000, ease: 'easeInOut' },
                    }}
                />
            </AnimatePresence>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,8,8,0.06)_0%,rgba(10,8,8,0.08)_52%,rgba(10,8,8,0.42)_100%)]" />

            <TooltipProvider delayDuration={120}>
                <div className="absolute bottom-5 right-5 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="inline-flex size-8 items-center justify-center rounded-full border border-white/18 bg-black/28 text-white/82 backdrop-blur-sm transition-colors hover:bg-black/42 hover:text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Refresh artwork"
                    >
                        <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-full border border-white/18 bg-black/28 text-white/82 backdrop-blur-sm transition-colors hover:bg-black/42 hover:text-white focus-visible:outline-none"
                                aria-label="Artwork citation"
                            >
                                <Info className="size-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="end" className="max-w-72 text-xs leading-5">
                            <div className="flex flex-col gap-1">
                                <p className="font-medium text-background">{selectedArtwork.artworkLine}</p>
                                <p className="text-background/72">{selectedArtwork.sourceLine}</p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>
        </div>
    );
};
