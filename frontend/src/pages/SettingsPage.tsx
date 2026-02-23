// input:  [auth context, user settings/import-export APIs, dialog helpers, theme hooks]
// output: [`SettingsPage` route component]
// pos:    [Global settings workspace for profile defaults, GPA rules, and data transfer]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useCallback, useEffect, useRef, useState, Suspense, lazy } from "react";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { GPAScalingTable } from "../components/GPAScalingTable";
import axios from "axios";

import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../components/BackButton";
import { Container } from "../components/Container";
import { SettingsSection } from "../components/SettingsSection";
import { loadGoogleIdentityScriptWhenIdle } from "../utils/googleIdentity";
import api from "../services/api";
import versionInfo from "../version.json";
import type { ImportData, ConflictMode } from "../components/ImportPreviewModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { cn } from "@/lib/utils";
import { useDialog } from '../contexts/DialogContext';
import { SaveSettingButton } from "../components/SaveSettingButton";
import { useTheme } from "../components/ThemeProvider";
import { DEFAULT_GPA_SCALING_TABLE_JSON } from "../utils/gpaUtils";

// Lazy load ImportPreviewModal - only loaded when user clicks Import
const ImportPreviewModal = lazy(() => import('../components/ImportPreviewModal').then(m => ({ default: m.ImportPreviewModal })));

export const SettingsPage: React.FC = () => {
    const { user, logout, refreshUser } = useAuth();
    const navigate = useNavigate();
    const { alert: showAlert, confirm } = useDialog();
    const { theme: themeMode, setTheme } = useTheme();

    const themeOptions: Array<{ value: "light" | "dark" | "system"; label: string }> = [
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "system", label: "System" }
    ];

    const handleThemeChange = (mode: "light" | "dark" | "system") => {
        setTheme(mode);
    };

    // Global Defaults State
    const [gpaTableJson, setGpaTableJson] = useState('{}');
    const [nickname, setNickname] = useState('');
    const [defaultCourseCredit, setDefaultCourseCredit] = useState(0.5);

    // Dirty checking
    const [initialState, setInitialState] = useState<{ nickname: string, gpaTableJson: string, defaultCourseCredit: number } | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    // Import modal state
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importData, setImportData] = useState<ImportData | null>(null);
    const [existingProgramNames, setExistingProgramNames] = useState<string[]>([]);

    const [googleLinkError, setGoogleLinkError] = useState('');
    const [googleLinkSuccess, setGoogleLinkSuccess] = useState(false);
    const [isGoogleLinking, setIsGoogleLinking] = useState(false);
    const [isGoogleLinkReady, setIsGoogleLinkReady] = useState(false);
    const googleLinkRef = useRef<HTMLDivElement>(null);
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    useEffect(() => {
        if (user) {
            const initialGpa = user.gpa_scaling_table ?? DEFAULT_GPA_SCALING_TABLE_JSON;
            const initialNick = user.nickname || '';
            const initialCredit = user.default_course_credit ?? 0.5;

            setGpaTableJson(initialGpa);
            setNickname(initialNick);
            setDefaultCourseCredit(initialCredit);
            setInitialState({ nickname: initialNick, gpaTableJson: initialGpa, defaultCourseCredit: initialCredit });
        }
    }, [user]);

    useEffect(() => {
        if (initialState) {
            const hasChanged = nickname !== initialState.nickname ||
                gpaTableJson !== initialState.gpaTableJson ||
                defaultCourseCredit !== initialState.defaultCourseCredit;
            setIsDirty(hasChanged);
        }
    }, [nickname, gpaTableJson, defaultCourseCredit, initialState]);

    useEffect(() => {
        setGoogleLinkError('');
        setGoogleLinkSuccess(false);
    }, [user?.google_sub]);

    useEffect(() => {
        if (!googleClientId || !user || user.google_sub) {
            return;
        }

        let cancelled = false;

        const initGoogle = async () => {
            try {
                await loadGoogleIdentityScriptWhenIdle();
            } catch {
                if (!cancelled) {
                    setGoogleLinkError('Google link is unavailable right now. Please try again later.');
                }
                return;
            }

            if (cancelled || !googleLinkRef.current) {
                return;
            }

            const google = (window as any).google;
            if (!google?.accounts?.id) {
                return;
            }

            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: async (response: { credential: string }) => {
                    if (!response?.credential) {
                        setGoogleLinkError('Google link failed. Please try again.');
                        return;
                    }
                    setGoogleLinkError('');
                    setIsGoogleLinking(true);
                    try {
                        await axios.post('/api/auth/google/link', {
                            id_token: response.credential
                        });
                        await refreshUser();
                        setGoogleLinkSuccess(true);
                    } catch (err: any) {
                        setGoogleLinkError(err.response?.data?.detail || 'Google link failed.');
                    } finally {
                        setIsGoogleLinking(false);
                    }
                }
            });

            google.accounts.id.renderButton(googleLinkRef.current, {
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'pill',
                width: '220'
            });

            setIsGoogleLinkReady(true);
        };

        initGoogle();

        return () => {
            cancelled = true;
        };
    }, [googleClientId, refreshUser, user]);

    // Warn on browser refresh/close
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Auto-save & Animation 
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resetSaveStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const saveSettings = useCallback(async () => {
        try {
            JSON.parse(gpaTableJson);
        } catch {
            // Don't auto-save invalid JSON, maybe show error? 
            // For now just return to avoid annoyance
            return;
        }

        if (resetSaveStateTimerRef.current) {
            clearTimeout(resetSaveStateTimerRef.current);
        }

        setSaveState('saving');
        try {
            await api.updateUser({
                gpa_scaling_table: gpaTableJson,
                nickname: nickname,
                default_course_credit: defaultCourseCredit
            });
            await refreshUser();

            setInitialState({ nickname, gpaTableJson, defaultCourseCredit });
            setIsDirty(false);

            setSaveState('success');
            if (resetSaveStateTimerRef.current) {
                clearTimeout(resetSaveStateTimerRef.current);
            }

            // Revert to idle after delay
            resetSaveStateTimerRef.current = setTimeout(() => {
                setSaveState('idle');
            }, 900);

        } catch (error) {
            console.error("Failed to save settings", error);
            setSaveState('idle'); // Or error state if needed
            await showAlert({
                title: "Save failed",
                description: "Failed to save settings."
            });
        }
    }, [defaultCourseCredit, gpaTableJson, nickname, refreshUser, showAlert]);

    // Auto-save Effect
    useEffect(() => {
        if (!initialState) return;

        // Check if actually changed
        const hasChanged = nickname !== initialState.nickname ||
            gpaTableJson !== initialState.gpaTableJson ||
            defaultCourseCredit !== initialState.defaultCourseCredit;

        if (hasChanged) {
            // Clear existing timer
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }

            // Set new timer
            autoSaveTimerRef.current = setTimeout(() => {
                void saveSettings();
            }, 1000); // 1s debounce
        }

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [nickname, gpaTableJson, defaultCourseCredit, initialState, saveSettings]);

    // Manual Back Handler
    const handleBack = async (e: React.MouseEvent) => {
        // If saving, wait? Or allow exit? Allow exit for now.
        // If dirty but not saved (network error?), confirm.
        if (isDirty && saveState === 'idle') {
            e.preventDefault();
            const shouldLeave = await confirm({
                title: "Unsaved changes",
                description: "You have unsaved changes. Are you sure you want to leave?",
                confirmText: "Leave",
                cancelText: "Stay",
                tone: "destructive"
            });
            if (shouldLeave) {
                navigate(-1);
            }
        } else {
            navigate(-1);
        }
    };

    // Mock user settings (unused for now)
    // const [email, setEmail] = useState(user?.email || '');

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const avatarInitial = (user?.email?.charAt(0).toUpperCase() || "U").trim();

    useEffect(() => {
        return () => {
            if (resetSaveStateTimerRef.current) {
                clearTimeout(resetSaveStateTimerRef.current);
            }
        };
    }, []);

    return (
        <Layout>
            <Container padding="2rem" className="max-w-2xl space-y-8 select-none">
                <BackButton label="Back to Home" onClick={handleBack} />

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground">
                        Manage your account settings and set global defaults.
                    </p>
                </div>

                <Separator />

                <div className="space-y-6">
                    <SettingsSection
                        title="Appearance"
                        description="Customize the look and feel of the application."
                    >
                        <div className="flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sm">
                            <Label htmlFor="theme-select" className="text-base">Theme</Label>
                            <div className="flex items-center gap-2">
                                {themeOptions.map((option) => (
                                    <Button
                                        key={option.value}
                                        variant={themeMode === option.value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handleThemeChange(option.value)}
                                        className="min-w-[80px]"
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Account"
                        description="Manage your profile and sign-in settings."
                    >
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 border">
                                    <AvatarFallback className="text-xl">{avatarInitial}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-lg font-semibold leading-none">
                                        {user?.nickname || user?.email}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {user?.email}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-3 max-w-sm">
                                <Label htmlFor="nickname-input">Display Name</Label>
                                <Input
                                    id="nickname-input"
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="Enter a nickname"
                                    className="max-w-md"
                                />
                            </div>

                            <div className="rounded-lg border bg-card p-4 shadow-sm">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">Google Account</p>
                                            {googleClientId && user?.google_sub ? (
                                                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">Linked</Badge>
                                            ) : (
                                                <Badge variant="outline">Not Linked</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Use your Google account to sign in securely.
                                        </p>
                                    </div>

                                    {googleClientId && !user?.google_sub && (
                                        <div
                                            className={cn(
                                                "shrink-0",
                                                isGoogleLinking && "opacity-70"
                                            )}
                                        >
                                            <div ref={googleLinkRef} />
                                            {!isGoogleLinkReady && (
                                                <p className="text-xs text-muted-foreground">
                                                    Loading...
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {(googleLinkError || googleLinkSuccess) && (
                                    <div className="mt-4">
                                        {googleLinkError && (
                                            <p className="text-sm text-destructive">{googleLinkError}</p>
                                        )}
                                        {googleLinkSuccess && (
                                            <p className="text-sm text-emerald-600">Google account linked successfully.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <Button
                                    variant="outline"
                                    onClick={handleLogout}
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                                >
                                    Sign Out
                                </Button>
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Global Defaults"
                        description="Set default values for new programs."
                    >
                        <div className="space-y-6">
                            <div className="grid gap-4">
                                <Label className="text-base">Default GPA Scaling Table</Label>
                                <GPAScalingTable
                                    value={gpaTableJson}
                                    onChange={(newValue) => {
                                        setGpaTableJson(newValue);
                                    }}
                                />
                                <p className="text-xs text-muted-foreground">
                                    This table will be applied to all new programs you create.
                                </p>
                            </div>

                            <div className="grid gap-3 pt-2">
                                <Label htmlFor="default-credit">Default Course Credit</Label>
                                <Input
                                    id="default-credit"
                                    type="number"
                                    step="0.5"
                                    value={defaultCourseCredit}
                                    onChange={(e) =>
                                        setDefaultCourseCredit(parseFloat(e.target.value) || 0)
                                    }
                                    className="max-w-[120px]"
                                />
                            </div>

                            <div className="flex justify-start pt-4">
                                <SaveSettingButton
                                    onClick={() => saveSettings()}
                                    saveState={saveState}
                                    label="Save Changes"
                                    className="min-w-[140px]"
                                />
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Data Management"
                        description="Export your data for backup or import from a backup file."
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="flex flex-col justify-between rounded-lg border p-4 shadow-sm">
                                <div className="space-y-2 mb-4">
                                    <p className="font-medium">Export Data</p>
                                    <p className="text-sm text-muted-foreground">
                                        Download a JSON file containing all your programs, semesters, and courses.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={async () => {
                                        try {
                                            const data = await api.exportUserData();
                                            const blob = new Blob(
                                                [JSON.stringify(data, null, 2)],
                                                { type: "application/json" }
                                            );
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = `semestra-backup-${new Date()
                                                .toISOString()
                                                .split("T")[0]}.json`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                        } catch (error) {
                                            console.error("Export failed:", error);
                                            await showAlert({
                                                title: "Export failed",
                                                description: "Export failed. Please try again."
                                            });
                                        }
                                    }}
                                >
                                    Download Backup
                                </Button>
                            </div>

                            <div className="flex flex-col justify-between rounded-lg border p-4 shadow-sm">
                                <div className="space-y-2 mb-4">
                                    <p className="font-medium">Import Data</p>
                                    <p className="text-sm text-muted-foreground">
                                        Restore your data from a valid Semestra backup file.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        const input = document.createElement("input");
                                        input.type = "file";
                                        input.accept = ".json,application/json";
                                        input.onchange = async (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0];
                                            if (!file) return;

                                            try {
                                                const text = await file.text();
                                                const data = JSON.parse(text) as ImportData;

                                                if (!data.programs || !Array.isArray(data.programs)) {
                                                    await showAlert({
                                                        title: "Invalid backup file",
                                                        description: "Invalid backup file format."
                                                    });
                                                    return;
                                                }

                                                const programs = await api.getPrograms();
                                                setExistingProgramNames(programs.map((p) => p.name));
                                                setImportData(data);
                                                setImportModalOpen(true);
                                            } catch (error: any) {
                                                console.error("Import failed:", error);
                                                await showAlert({
                                                    title: "Import failed",
                                                    description:
                                                        "Import failed. Please make sure the file is a valid Semestra backup."
                                                });
                                            }
                                        };
                                        input.click();
                                    }}
                                >
                                    Restore Backup
                                </Button>
                            </div>

                            {importModalOpen && (
                                <Suspense fallback={null}>
                                    <ImportPreviewModal
                                        isOpen={importModalOpen}
                                        onClose={() => {
                                            setImportModalOpen(false);
                                            setImportData(null);
                                        }}
                                        importData={importData}
                                        existingProgramNames={existingProgramNames}
                                        onConfirm={async (
                                            conflictMode: ConflictMode,
                                            includeSettings: boolean
                                        ) => {
                                            if (!importData) return;
                                            const result = await api.importUserData(
                                                importData,
                                                conflictMode,
                                                includeSettings
                                            );
                                            await showAlert({
                                                title: "Import successful",
                                                description: `Imported: ${result.imported.programs} programs, ${result.imported.semesters} semesters, ${result.imported.courses} courses${result.skipped?.programs > 0 ? `\nSkipped: ${result.skipped.programs} programs (conflicts)` : ""}`
                                            });
                                            await refreshUser();
                                        }}
                                    />
                                </Suspense>
                            )}
                        </div>
                    </SettingsSection>
                </div>

                <Separator />
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-4">
                    <span>Semestra v{versionInfo.version}</span>
                    <span>•</span>
                    <span>
                        {versionInfo.branch} ({versionInfo.commit})
                    </span>
                </div>
            </Container>
        </Layout>
    );
};
