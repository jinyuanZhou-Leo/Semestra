// input:  [router outlet/link primitives, shared auth artwork panel, theme toggle, and Semestra brand asset]
// output: [`AuthRouteLayout` shared public-auth route shell component]
// pos:    [Route layout that keeps the auth split-screen chrome and artwork panel mounted while login/register forms swap inside the outlet]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { Link, Outlet } from 'react-router-dom';

import semestraLogoRect from '@/assets/semestra-logo-rect.webp';
import { AuthArtPanel } from '@/components/AuthArtPanel';
import { ThemeToggle } from '@/components/ThemeToggle';

export const AuthRouteLayout: React.FC = () => (
    <div className="grid min-h-svh overflow-x-hidden lg:grid-cols-2 lg:overflow-hidden">
        <div className="flex flex-col gap-4 p-6 md:p-10">
            <div className="flex items-center justify-between gap-4">
                <div className="flex flex-1 justify-center md:justify-start">
                    <Link to="/landing" className="inline-flex select-none items-center gap-1.5 font-medium leading-none">
                        <img src={semestraLogoRect} alt="Semestra" className="size-6 shrink-0 rounded-md object-cover" />
                        <span className="pt-px">Semestra</span>
                    </Link>
                </div>
                <ThemeToggle />
            </div>

            <div className="flex flex-1 items-center justify-center">
                <Outlet />
            </div>
        </div>

        <AuthArtPanel />
    </div>
);
