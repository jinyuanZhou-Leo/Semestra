import React, { useEffect, useRef, useState, Suspense, lazy } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useDialog } from '../contexts/DialogContext';

// Lazy load ImportPreviewModal - only loaded when user clicks Import
const ImportPreviewModal = lazy(() => import('../components/ImportPreviewModal').then(m => ({ default: m.ImportPreviewModal })));

export const SettingsPage: React.FC = () => {
    const { user, logout, refreshUser } = useAuth();
    const navigate = useNavigate();
    const { alert: showAlert, confirm } = useDialog();

    // Theme state
    const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(
        () => {
            const saved = localStorage.getItem("themePreference");
            return saved === "light" || saved === "dark" || saved === "system"
                ? saved
                : "system";
        }
    );

    const themeOptions: Array<{ value: "light" | "dark" | "system"; label: string }> = [
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "system", label: "System" }
    ];

    const applyTheme = (mode: "light" | "dark" | "system") => {
        if (mode === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light";
            document.documentElement.setAttribute("data-theme", systemTheme);
        } else {
            document.documentElement.setAttribute("data-theme", mode);
        }
    };

    const handleThemeChange = (mode: "light" | "dark" | "system") => {
        setThemeMode(mode);
        localStorage.setItem("themePreference", mode);
        applyTheme(mode);
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
    const alertClassName = (variant?: "destructive") =>
        cn(
            "relative w-full rounded-lg border p-4 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
            variant === "destructive"
                ? "border-destructive/50 text-destructive dark:border-destructive"
                : "bg-background text-foreground"
        );

    useEffect(() => {
        if (user) {
            const initialGpa = (user as any).gpa_scaling_table || '{"90-100": 4.0, "85-89": 4.0, "80-84": 3.7, "77-79": 3.3, "73-76": 3.0, "70-72": 2.7, "67-69": 2.3, "63-66": 2.0, "60-62": 1.7, "57-59": 1.3, "53-56": 1.0, "50-52": 0.7, "0-49": 0}';
            const initialNick = user.nickname || '';
            const initialCredit = (user as any).default_course_credit || 0.5;

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
            } catch (err) {
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
                saveSettings();
            }, 1000); // 1s debounce
        }

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [nickname, gpaTableJson, defaultCourseCredit, initialState]);

    const saveSettings = async () => {
        try {
            JSON.parse(gpaTableJson);
        } catch {
            // Don't auto-save invalid JSON, maybe show error? 
            // For now just return to avoid annoyance
            return;
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

            // Revert to idle after delay
            setTimeout(() => {
                setSaveState('idle');
            }, 2000);

        } catch (error) {
            console.error("Failed to save settings", error);
            setSaveState('idle'); // Or error state if needed
            await showAlert({
                title: "Save failed",
                description: "Failed to save settings."
            });
        }
    };

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

    return (
        <Layout>
            <Container padding="2rem" className="space-y-8 select-none">
                <BackButton label="Back to Home" onClick={handleBack} />

                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">Settings</h1>
                    </div>
                </div>

                <div className="space-y-6">
                    <SettingsSection
                        title="Appearance"
                        description="Customize the look and feel of the application."
                        center
                    >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium">Theme</p>
                            </div>
                            <RadioGroup
                                value={themeMode}
                                onValueChange={(value) =>
                                    handleThemeChange(value as "light" | "dark" | "system")
                                }
                                className="grid grid-cols-3 gap-2"
                            >
                                {themeOptions.map((option) => (
                                    <div key={option.value} className="relative">
                                        <RadioGroupItem
                                            id={`theme-${option.value}`}
                                            value={option.value}
                                            className="peer sr-only"
                                        />
                                        <Label
                                            htmlFor={`theme-${option.value}`}
                                            className={cn(
                                                "flex min-w-[96px] items-center justify-center rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground transition",
                                                "hover:border-muted-foreground/40 hover:text-foreground",
                                                "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary"
                                            )}
                                        >
                                            {option.label}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Account"
                        description="Manage your profile and sign-in settings."
                    >
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center gap-4">
                                <Avatar className="h-14 w-14">
                                    <AvatarFallback>{avatarInitial}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-base font-semibold">
                                        {user?.nickname || user?.email}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {user?.email}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-2 sm:max-w-md">
                                <Label htmlFor="nickname-input">Nickname</Label>
                                <Input
                                    id="nickname-input"
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="Enter a nickname"
                                />
                            </div>

                            <Separator />

                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium">Google</p>
                                    <p className="text-xs text-muted-foreground">
                                        {user?.google_sub
                                            ? "Connected to your account"
                                            : "Connect Google for one-click sign in"}
                                    </p>
                                </div>
                                {googleClientId ? (
                                    user?.google_sub ? (
                                        <Badge variant="secondary">Connected</Badge>
                                    ) : (
                                        <div
                                            className={cn(
                                                "min-w-[220px]",
                                                isGoogleLinking && "opacity-70"
                                            )}
                                        >
                                            <div ref={googleLinkRef} />
                                            {!isGoogleLinkReady && (
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Loading Google sign-in...
                                                </p>
                                            )}
                                        </div>
                                    )
                                ) : (
                                    <Badge variant="outline">Not configured</Badge>
                                )}
                            </div>

                            {googleLinkError && (
                                <div className={alertClassName("destructive")} role="alert">
                                    <div className="mb-1 font-medium leading-none tracking-tight">Google link failed</div>
                                    <div className="text-sm text-muted-foreground">{googleLinkError}</div>
                                </div>
                            )}

                            {googleLinkSuccess && (
                                <div className={alertClassName()} role="alert">
                                    <div className="mb-1 font-medium leading-none tracking-tight">Google connected</div>
                                    <div className="text-sm text-muted-foreground">
                                        Your Google account is linked successfully.
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end">
                                <Button
                                    variant="secondary"
                                    onClick={handleLogout}
                                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                >
                                    Sign Out
                                </Button>
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Global Defaults"
                        description="Set defaults for new programs when no custom table is defined."
                    >
                        <div className="space-y-6">
                            <div className="grid gap-3">
                                <Label>Default GPA Scaling Table</Label>
                                <GPAScalingTable
                                    value={gpaTableJson}
                                    onChange={(newValue) => {
                                        setGpaTableJson(newValue);
                                    }}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="default-credit">Default Course Credit</Label>
                                <Input
                                    id="default-credit"
                                    type="number"
                                    step="0.5"
                                    value={defaultCourseCredit}
                                    onChange={(e) =>
                                        setDefaultCourseCredit(parseFloat(e.target.value) || 0)
                                    }
                                    className="max-w-[160px]"
                                />
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-3">
                                <Button
                                    onClick={() => saveSettings()}
                                    disabled={saveState === "saving"}
                                    className="min-w-[160px]"
                                >
                                    {saveState === "saving" && (
                                        <Spinner className="mr-2 size-3" />
                                    )}
                                    {saveState === "success" && (
                                        <span className="mr-2 text-emerald-500">✓</span>
                                    )}
                                    {saveState === "success"
                                        ? "Saved"
                                        : saveState === "saving"
                                            ? "Saving..."
                                            : "Save Settings"}
                                </Button>
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Data Management"
                        description="Backup and restore your account data."
                        center
                    >
                        <div className="grid gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/40 p-4">
                                <div>
                                    <p className="text-sm font-medium">Export Data</p>
                                    <p className="text-xs text-muted-foreground">
                                        Download all your programs, semesters, and courses as a JSON
                                        file.
                                    </p>
                                </div>
                                <Button
                                    variant="secondary"
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
                                    Export
                                </Button>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/40 p-4">
                                <div>
                                    <p className="text-sm font-medium">Import Data</p>
                                    <p className="text-xs text-muted-foreground">
                                        Restore data from a previously exported JSON file.
                                    </p>
                                </div>
                                <Button
                                    variant="secondary"
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
                                    Import
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
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span>v{versionInfo.version}</span>
                    <span>•</span>
                    <span>
                        {versionInfo.branch}@{versionInfo.commit}
                    </span>
                </div>
            </Container>
        </Layout>
    );
};
