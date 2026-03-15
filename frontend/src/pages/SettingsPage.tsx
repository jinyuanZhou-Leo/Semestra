// input:  [auth context/actions, user settings/import-export/LMS persistence APIs, dialog helpers, theme hooks, switch controls, responsive dialog wrapper, and LMS integration manager component]
// output: [`SettingsPage` route component]
// pos:    [Global settings workspace for profile defaults, multi-integration LMS management, plugin preload preferences, GPA rules, and data transfer with mobile-safe responsive layout, shadcn Field-based form structure, debounced auto-save persistence, backup restore dialog flow, and account sign-out]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy, useId } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldSet,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useDialog } from '../contexts/DialogContext';
import { useTheme } from "../components/ThemeProvider";
import { DEFAULT_GPA_SCALING_TABLE_JSON } from "../utils/gpaUtils";
import { useAutoSave } from "../hooks/useAutoSave";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Upload } from "lucide-react";
import { ResponsiveDialogDrawer } from "../components/ResponsiveDialogDrawer";
import { LmsIntegrationManager } from "@/components/settings/LmsIntegrationManager";

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
    const [backgroundPluginPreload, setBackgroundPluginPreload] = useState(true);

    // Dirty checking
    const [initialState, setInitialState] = useState<{
        nickname: string;
        gpaTableJson: string;
        defaultCourseCredit: number;
        backgroundPluginPreload: boolean;
    } | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    // Import modal state
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importData, setImportData] = useState<ImportData | null>(null);
    const [existingProgramNames, setExistingProgramNames] = useState<string[]>([]);
    const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(null);
    const [isRestoreDragging, setIsRestoreDragging] = useState(false);
    const [isPreparingImport, setIsPreparingImport] = useState(false);
    const restoreBackupFormId = useId();
    const restoreBackupFileInputId = useId();
    const restoreBackupFileInputRef = useRef<HTMLInputElement>(null);

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
            const initialBackgroundPluginPreload = user.background_plugin_preload ?? true;

            setGpaTableJson(initialGpa);
            setNickname(initialNick);
            setDefaultCourseCredit(initialCredit);
            setBackgroundPluginPreload(initialBackgroundPluginPreload);
            setInitialState({
                nickname: initialNick,
                gpaTableJson: initialGpa,
                defaultCourseCredit: initialCredit,
                backgroundPluginPreload: initialBackgroundPluginPreload,
            });
        }
    }, [user]);

    useEffect(() => {
        if (initialState) {
            const hasChanged = nickname !== initialState.nickname ||
                gpaTableJson !== initialState.gpaTableJson ||
                defaultCourseCredit !== initialState.defaultCourseCredit ||
                backgroundPluginPreload !== initialState.backgroundPluginPreload;
            setIsDirty(hasChanged);
        }
    }, [nickname, gpaTableJson, defaultCourseCredit, backgroundPluginPreload, initialState]);

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

    const settingsSnapshot = useMemo(() => ({
        nickname,
        gpaTableJson,
        defaultCourseCredit,
        backgroundPluginPreload
    }), [backgroundPluginPreload, defaultCourseCredit, gpaTableJson, nickname]);
    const isSettingsValid = useMemo(() => {
        try {
            JSON.parse(gpaTableJson);
            return true;
        } catch {
            return false;
        }
    }, [gpaTableJson]);

    const updateUserMutation = useMutation({
        mutationFn: async (snapshot: typeof settingsSnapshot) => {
            await api.updateUser({
                gpa_scaling_table: snapshot.gpaTableJson,
                nickname: snapshot.nickname,
                default_course_credit: snapshot.defaultCourseCredit,
                background_plugin_preload: snapshot.backgroundPluginPreload
            });
            await refreshUser();
        },
    });

    const { saveState } = useAutoSave({
        value: settingsSnapshot,
        savedValue: initialState ?? settingsSnapshot,
        enabled: !!initialState,
        isEqual: (left, right) =>
            left.nickname === right.nickname
            && left.gpaTableJson === right.gpaTableJson
            && left.defaultCourseCredit === right.defaultCourseCredit
            && left.backgroundPluginPreload === right.backgroundPluginPreload,
        validate: () => isSettingsValid,
        onSave: async (snapshot) => {
            await updateUserMutation.mutateAsync(snapshot);
            setInitialState(snapshot);
            setIsDirty(false);
        },
        onError: async () => {
            await showAlert({
                title: "Save failed",
                description: "Failed to save settings."
            });
        }
    });

    const clearRestoreBackupState = useCallback(() => {
        setSelectedBackupFile(null);
        setIsRestoreDragging(false);
        if (restoreBackupFileInputRef.current) {
            restoreBackupFileInputRef.current.value = "";
        }
    }, []);

    const syncRestoreBackupFile = useCallback(async (file: File | null) => {
        if (!file) return;

        const isJsonFile = file.name.toLowerCase().endsWith(".json") || file.type === "application/json";
        if (!isJsonFile) {
            await showAlert({
                title: "Invalid backup file",
                description: "Please choose a valid Semestra backup file in JSON format."
            });
            return;
        }

        setSelectedBackupFile(file);
    }, [showAlert]);

    const handlePrepareImport = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedBackupFile) {
            await showAlert({
                title: "Backup file required",
                description: "Choose a Semestra backup file before continuing."
            });
            return;
        }

        setIsPreparingImport(true);
        try {
            const text = await selectedBackupFile.text();
            const data = JSON.parse(text) as ImportData;

            if (!data.programs || !Array.isArray(data.programs)) {
                await showAlert({
                    title: "Invalid backup file",
                    description: "Invalid backup file format."
                });
                return;
            }

            const programs = await api.getPrograms();
            setExistingProgramNames(programs.map((program) => program.name));
            setImportData(data);
            setRestoreDialogOpen(false);
            clearRestoreBackupState();
            setImportModalOpen(true);
        } catch (error) {
            console.error("Import failed:", error);
            await showAlert({
                title: "Import failed",
                description: "Import failed. Please make sure the file is a valid Semestra backup."
            });
        } finally {
            setIsPreparingImport(false);
        }
    }, [clearRestoreBackupState, selectedBackupFile, showAlert]);

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

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const avatarInitial = (user?.email?.charAt(0).toUpperCase() || "U").trim();

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground">Settings</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

    return (
        <Layout breadcrumb={breadcrumb}>
            <Container className="space-y-8 select-none py-8">
                <BackButton label="Back" onClick={handleBack} />

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground">
                        Manage your account settings and set global defaults.
                    </p>
                </div>

                <Separator />

                <div className="space-y-6">
                    <SettingsSection
                        title="Account"
                        description="Manage your profile and sign-in settings."
                    >
                        <div className="space-y-6">
                            {/* Profile identity block */}
                            <div className="flex min-w-0 items-center gap-4">
                                <Avatar className="h-14 w-14 border">
                                    <AvatarFallback className="text-lg">{avatarInitial}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="text-base font-semibold leading-snug">
                                        {user?.nickname || user?.email}
                                    </p>
                                    <p className="break-all text-sm text-muted-foreground">
                                        {user?.email}
                                    </p>
                                </div>
                            </div>

                            {/* Display Name */}
                            <FieldSet className="max-w-sm">
                                <FieldGroup>
                                    <Field>
                                        <FieldLabel htmlFor="nickname-input">Display Name</FieldLabel>
                                        <Input
                                            id="nickname-input"
                                            type="text"
                                            value={nickname}
                                            onChange={(e) => setNickname(e.target.value)}
                                            placeholder="Enter a nickname"
                                        />
                                    </Field>
                                </FieldGroup>
                            </FieldSet>

                            <Separator />

                            {/* Connected Accounts */}
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium">Google Account</p>
                                            {googleClientId && user?.google_sub ? (
                                                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-xs">Linked</Badge>
                                            ) : (
                                                    <Badge variant="outline" className="text-xs">Not Linked</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Sign in to Semestra using your Google account.
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
                                                <p className="text-xs text-muted-foreground">Loading...</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {(googleLinkError || googleLinkSuccess) && (
                                    <div>
                                        {googleLinkError && (
                                            <p className="text-sm text-destructive">{googleLinkError}</p>
                                        )}
                                        {googleLinkSuccess && (
                                            <p className="text-sm text-emerald-600">Google account linked successfully.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Session Management */}
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">Sign Out</p>
                                        <p className="text-sm text-muted-foreground">
                                            End your current session on this device.
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={handleLogout}
                                        className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                                    >
                                        Sign Out
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="LMS Integration"
                        description="Connect learning platforms."
                    >
                        <div className="w-full">
                            <LmsIntegrationManager />
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Preferences"
                        description="Customize the application appearance and set default behaviors."
                    >
                        <div className="space-y-6">
                            <FieldSet>
                                <FieldGroup>
                                    <Field>
                                        <FieldLabel>Theme</FieldLabel>
                                        <FieldDescription>Select your preferred color scheme.</FieldDescription>
                                        <div className="flex w-full flex-wrap items-center gap-2">
                                            {themeOptions.map((option) => (
                                                <Button
                                                    key={option.value}
                                                    variant={themeMode === option.value ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => handleThemeChange(option.value)}
                                                    className="min-w-[80px] flex-1 sm:flex-none"
                                                >
                                                    {option.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </Field>
                                </FieldGroup>
                            </FieldSet>

                            <Separator />

                            <FieldSet>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldContent>
                                            <FieldLabel htmlFor="background-plugin-preload">
                                                Preload plugins in the background
                                            </FieldLabel>
                                            <FieldDescription>
                                                After the page finishes loading, use browser idle time to warm up the remaining plugins.
                                            </FieldDescription>
                                        </FieldContent>
                                        <Switch
                                            id="background-plugin-preload"
                                            checked={backgroundPluginPreload}
                                            onCheckedChange={setBackgroundPluginPreload}
                                            className="shrink-0"
                                        />
                                    </Field>
                                </FieldGroup>
                            </FieldSet>

                            <Separator />

                            <div className="grid gap-4">
                                <p className="text-base font-medium">Default GPA Scaling Table</p>
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

                            <Separator />

                            <FieldSet>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldContent>
                                            <FieldLabel htmlFor="default-credit">Default Course Credit</FieldLabel>
                                            <FieldDescription>
                                                The default number of credits assigned to new courses.
                                            </FieldDescription>
                                        </FieldContent>
                                        <Input
                                            id="default-credit"
                                            type="number"
                                            step="0.5"
                                            value={defaultCourseCredit}
                                            onChange={(e) =>
                                                setDefaultCourseCredit(parseFloat(e.target.value) || 0)
                                            }
                                            className="w-full @md/field-group:w-[120px] shrink-0"
                                        />
                                    </Field>
                                </FieldGroup>
                            </FieldSet>

                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Data Management"
                        description="Export your data for backup or import from a backup file."
                    >
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1 mb-2 sm:mb-0">
                                    <p className="font-medium text-base">Export Data</p>
                                    <p className="text-sm text-muted-foreground">
                                        Download a JSON file containing all your programs, semesters, and courses.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
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

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1 mb-2 sm:mb-0">
                                    <p className="font-medium text-base">Restore From Backup</p>
                                    <p className="text-sm text-muted-foreground">
                                        Restore your data from a valid Semestra backup file.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        clearRestoreBackupState();
                                        setRestoreDialogOpen(true);
                                    }}
                                >
                                    Restore From Backup
                                </Button>
                            </div>

                            <ResponsiveDialogDrawer
                                open={restoreDialogOpen}
                                onOpenChange={(open) => {
                                    setRestoreDialogOpen(open);
                                    if (!open) {
                                        clearRestoreBackupState();
                                    }
                                }}
                                title="Restore From Backup"
                                description="Upload a Semestra backup file to review and restore your data."
                                desktopContentClassName="sm:max-w-[425px]"
                                mobileContentClassName="h-[85vh] max-h-[85vh]"
                                footer={(
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setRestoreDialogOpen(false);
                                                clearRestoreBackupState();
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            form={restoreBackupFormId}
                                            disabled={!selectedBackupFile || isPreparingImport}
                                        >
                                            {isPreparingImport ? "Preparing..." : "Review Backup"}
                                        </Button>
                                    </>
                                )}
                                desktopFooterClassName="pt-4"
                                mobileFooterClassName="px-0"
                            >
                                <form
                                    id={restoreBackupFormId}
                                    onSubmit={handlePrepareImport}
                                    className="space-y-4 overflow-y-auto px-4 pb-4 sm:space-y-4 sm:px-0 sm:py-4 sm:pb-0"
                                >
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Backup File</p>
                                        <div
                                            className={cn(
                                                "cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all",
                                                isRestoreDragging
                                                    ? "border-primary bg-primary/5"
                                                    : "border-muted-foreground/25 hover:border-primary/50"
                                            )}
                                            onClick={() => restoreBackupFileInputRef.current?.click()}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                setIsRestoreDragging(true);
                                            }}
                                            onDragLeave={(event) => {
                                                event.preventDefault();
                                                setIsRestoreDragging(false);
                                            }}
                                            onDrop={async (event) => {
                                                event.preventDefault();
                                                setIsRestoreDragging(false);
                                                const file = event.dataTransfer.files?.[0] ?? null;
                                                await syncRestoreBackupFile(file);
                                            }}
                                        >
                                            <input
                                                ref={restoreBackupFileInputRef}
                                                id={restoreBackupFileInputId}
                                                type="file"
                                                accept=".json,application/json"
                                                className="hidden"
                                                onChange={async (event) => {
                                                    const file = event.target.files?.[0] ?? null;
                                                    await syncRestoreBackupFile(file);
                                                }}
                                            />
                                            <div className="flex flex-col items-center gap-2">
                                                {selectedBackupFile ? (
                                                    <div className="flex items-center gap-2 font-medium text-primary">
                                                        <Upload className="h-5 w-5" />
                                                        <span className="break-all">{selectedBackupFile.name}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload className="h-8 w-8 text-muted-foreground/50" />
                                                        <div className="text-sm text-muted-foreground">
                                                            Click or drag a `.json` backup file to upload
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            The backup will be validated before you choose how to merge it.
                                        </p>
                                    </div>
                                </form>
                            </ResponsiveDialogDrawer>

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
                <div className="flex flex-wrap items-center justify-center gap-2 py-4 text-center text-xs text-muted-foreground">
                    <span>Semestra v{versionInfo.version}</span>
                    <span>•</span>
                    <span className="break-all">
                        {versionInfo.branch} ({versionInfo.commit})
                    </span>
                </div>
            </Container>
        </Layout>
    );
};
