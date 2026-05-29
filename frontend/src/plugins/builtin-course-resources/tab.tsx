// input:  [course/semester resource API, plugin settings framework, plugin UI-state hook, shadcn dialog/tabs/field primitives, and shared helpers]
// output: [`CourseResourcesTabDefinition` — course-resources tab supporting both semester (folder view) and course (single-folder) contexts]
// pos:    [Dual-context resource manager: semester view shows course folders + resources; course view locks to one folder. Sort order via plugin settings framework; quota in three-state (loading/success/error). Add-resource modal uses fixed-height flex layout with stable tab switching.]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowDown,
    ArrowUpDown,
    ArrowUp,
    Download,
    File,
    FileArchive,
    FileAudio,
    FileCode2,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileVideo,
    FolderOpen,
    Link2,
    Loader2,
    MoreHorizontal,
    Pencil,
    Info,
    Trash2,
    Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppEmptyState } from '@/components/AppEmptyState';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { usePluginUiState } from '@/plugin-sdk';
import { useSemesterQuery } from '@/data/resources/workspaceEntities';
import api, { type CourseFolderWithResources, type CourseResourceFile } from '@/services/api';
import { courseKeys, semesterKeys } from '@/services/queryKeys';
import type { TabDefinition, TabProps } from '@/plugin-system';

import {
    COURSE_RESOURCES_TAB_TYPE,
    DEFAULT_SORT_ORDER,
    type ResourceSortOrder,
    formatBytes,
    formatTimestamp,
    getResourceExtensionLabel,
    isExternalCourseResource,
    resolveResourceSortOrder,
    resolveCourseResourceHref,
    sortFiles,
} from './shared';
import { ExternalResourceConfirmDialog, type ExternalResourceOpenTarget } from './ExternalResourceConfirmDialog';

// ─── Constants ───────────────────────────────────────────────────────────────

const RESOURCE_LIMIT_MESSAGE = 'Uploading these files would exceed the 50MB account resource limit.';
const SCRIPT_FILE_MESSAGE = 'Script files are not allowed. Remove .sh, .bat, .ps1, .cmd, and similar executable files.';
// ⚠️ Keep in sync with BLOCKED_UPLOAD_EXTENSIONS in backend/course_resources.py
const BLOCKED_UPLOAD_EXTENSIONS = new Set([
    '.bat', '.bash', '.cmd', '.com', '.csh', '.ksh',
    '.ps1', '.psm1', '.py', '.rb', '.sh', '.vbs', '.zsh',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function extractErrorMessage(error: unknown, fallback: string): string {
    if (isRecord(error)) {
        const response = error.response;
        if (isRecord(response)) {
            const data = response.data;
            if (isRecord(data)) {
                const detail = data.detail;
                if (isRecord(detail) && typeof detail.message === 'string') return detail.message;
            }
        }
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

const isBlockedUploadFile = (file: File) => {
    const lastDot = file.name.lastIndexOf('.');
    const suffix = lastDot >= 0 ? file.name.slice(lastDot).toLowerCase() : '';
    return BLOCKED_UPLOAD_EXTENSIONS.has(suffix);
};

const getResourceIcon = (resource: Pick<CourseResourceFile, 'mime_type' | 'filename_display' | 'filename_original' | 'resource_kind'>) => {
    if (resource.resource_kind === 'link') return Link2;
    const name = resource.filename_display || resource.filename_original;
    const lastDot = name.lastIndexOf('.');
    const suffix = lastDot >= 0 ? name.slice(lastDot).toLowerCase() : '';
    if (resource.mime_type.startsWith('image/')) return FileImage;
    if (resource.mime_type.startsWith('audio/')) return FileAudio;
    if (resource.mime_type.startsWith('video/')) return FileVideo;
    if (resource.mime_type.includes('zip') || ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(suffix)) return FileArchive;
    if (resource.mime_type.includes('sheet') || ['.csv', '.xls', '.xlsx', '.numbers'].includes(suffix)) return FileSpreadsheet;
    if (resource.mime_type.startsWith('text/') || ['.doc', '.docx', '.md', '.pdf', '.ppt', '.pptx', '.rtf', '.txt'].includes(suffix)) return FileText;
    if (['.html', '.js', '.jsx', '.json', '.ts', '.tsx'].includes(suffix)) return FileCode2;
    return File;
};

// ─── UI-state shape (persisted via usePluginUiState) ─────────────────────────

interface CourseResourcesUiState {
    activeUploadTab: 'files' | 'link';
    linkUrl: string;
    linkName: string;
    sortOrder: ResourceSortOrder;
    selectedFolderId: string;
}

interface ResourceFolderDetails {
    course_id: string;
    course_name: string;
    files: CourseResourceFile[];
}

// ─── Quota badge ──────────────────────────────────────────────────────────────

const QuotaBadge: React.FC<{
    status: 'pending' | 'success' | 'error';
    totalBytesUsed?: number;
    totalBytesLimit?: number;
}> = ({ status, totalBytesUsed, totalBytesLimit }) => {
    const progressValue = status === 'success' && totalBytesUsed !== undefined && totalBytesLimit
        ? Math.min(100, Math.max(0, (totalBytesUsed / totalBytesLimit) * 100))
        : 0;
    const radius = 7;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (progressValue / 100) * circumference;

    return (
        <div className="flex items-center gap-2">
            <div className="relative flex h-4 w-4 items-center justify-center">
                {status === 'pending' ? (
                    <Skeleton className="h-4 w-4 rounded-full" />
                ) : (
                    <svg className="h-4 w-4 -rotate-90" viewBox="0 0 20 20" aria-hidden="true">
                        <circle cx="10" cy="10" r={radius} fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/70" />
                        <circle
                            cx="10"
                            cy="10"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            className={status === 'error' ? 'text-destructive' : 'text-primary'}
                        />
                    </svg>
                )}
            </div>
            <div className="min-w-0 text-sm text-muted-foreground">
                {status === 'pending' && <Skeleton className="h-4 w-32 rounded" />}
                {status === 'success' && totalBytesUsed !== undefined && totalBytesLimit !== undefined && (
                    <span>{formatBytes(totalBytesUsed)} of {formatBytes(totalBytesLimit)} used</span>
                )}
                {status === 'error' && <span className="text-destructive">Storage usage unavailable</span>}
            </div>
        </div>
    );
};

// ─── Upload selection list ────────────────────────────────────────────────────

const UploadSelectionList: React.FC<{
    files: File[];
    onRemove: (index: number) => void;
}> = ({ files, onRemove }) => {
    if (files.length === 0) return null;
    return (
        <div className="space-y-2 rounded-xl bg-muted/35 p-3">
            {files.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(index)}>
                        Remove
                    </Button>
                </div>
            ))}
        </div>
    );
};

// ─── Shared display primitives ───────────────────────────────────────────────

const ReadonlyValue: React.FC<{ value: string }> = ({ value }) => (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground">
        {value}
    </div>
);

// ─── File-manager rows (semester explorer view) ──────────────────────────────

const CourseFolderList: React.FC<{
    folders: CourseFolderWithResources[];
    onSelect: (courseId: string) => void;
    onDetails: (folder: ResourceFolderDetails) => void;
}> = ({ folders, onSelect, onDetails }) => {
    return (
        <div className="divide-y divide-border/60 border-y border-border/60">
            {folders.map((folder) => (
                <button
                    key={folder.course_id}
                    type="button"
                    onClick={() => onSelect(folder.course_id)}
                    className="flex w-full items-center gap-3 px-2 py-3 text-left text-sm transition-colors hover:bg-muted/35"
                >
                    <FolderOpen className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{folder.course_name}</div>
                        <div className="text-xs text-muted-foreground">
                            {folder.files.length} resource{folder.files.length === 1 ? '' : 's'}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open folder actions</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-36" onClick={(event) => event.stopPropagation()}>
                            <DropdownMenuItem onClick={() => onDetails(folder)}>
                                <Info className="h-3.5 w-3.5" />
                                Details
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </button>
            ))}
        </div>
    );
};

const SemesterResourceExplorerList: React.FC<{
    courseId: string;
    files: CourseResourceFile[];
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    onAdd: () => void;
    onRename: (resource: CourseResourceFile) => void;
    onDelete: (resource: CourseResourceFile) => void;
    onDetails: (resource: CourseResourceFile) => void;
    onOpenExternalResource: (resource: CourseResourceFile, url: string) => void;
}> = ({ courseId, files, isLoading, isError, onRetry, onAdd, onRename, onDelete, onDetails, onOpenExternalResource }) => {
    if (isLoading) {
        return (
            <div className="space-y-2">
                {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-14 rounded-lg" />
                ))}
            </div>
        );
    }
    if (isError) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Unable to load resources"
                description="The latest resource list could not be loaded."
                primaryAction={<Button type="button" onClick={onRetry}>Retry</Button>}
            />
        );
    }
    if (files.length === 0) {
        return (
            <AppEmptyState
                scenario="create"
                size="section"
                title="No resources yet"
                description="Add files or save a URL for this course folder."
                primaryAction={
                    <Button type="button" onClick={onAdd}>
                        <Upload className="h-4 w-4" />
                        Add resource
                    </Button>
                }
            />
        );
    }

    return (
        <ScrollArea className="min-h-0 flex-1">
            <div className="divide-y divide-border/60 border-y border-border/60">
                {files.map((resource) => {
                    const openUrl = resolveCourseResourceHref(courseId, resource);
                    const opensExternalUrl = isExternalCourseResource(resource);
                    const ResourceIcon = getResourceIcon(resource);
                    return (
                        <div key={resource.id} className="flex items-center gap-3 px-2 py-3">
                            <ResourceIcon className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                                {opensExternalUrl ? (
                                    <button
                                        type="button"
                                        onClick={() => onOpenExternalResource(resource, openUrl)}
                                        className="block max-w-full truncate text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
                                    >
                                        {resource.filename_display}
                                    </button>
                                ) : (
                                    <a
                                        href={openUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                                    >
                                        {resource.filename_display}
                                    </a>
                                )}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    <span>{resource.resource_kind === 'link' ? 'Saved URL' : getResourceExtensionLabel(resource)}</span>
                                    <span>{resource.resource_kind === 'link' ? 'No local file' : formatBytes(resource.size_bytes)}</span>
                                    <span>Updated {formatTimestamp(resource.updated_at)}</span>
                                </div>
                            </div>
                            {resource.resource_kind === 'file' ? (
                                <Button type="button" variant="ghost" size="sm" asChild>
                                    <a href={api.buildCourseResourceOpenUrl(courseId, resource.id, { download: true })} target="_blank" rel="noreferrer">
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </a>
                                </Button>
                            ) : null}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Open resource actions</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-36">
                                    <DropdownMenuItem onClick={() => onDetails(resource)}>
                                        <Info className="h-3.5 w-3.5" />
                                        Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onRename(resource)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                        Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(resource)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
};

const SortMenu: React.FC<{
    field: 'name' | 'time';
    direction: 'asc' | 'desc';
    onFieldChange: (field: 'name' | 'time') => void;
    onDirectionChange: (direction: 'asc' | 'desc') => void;
}> = ({ field, direction, onFieldChange, onDirectionChange }) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9">
                    <ArrowUpDown className="h-4 w-4" />
                    <span className="sr-only">Sort resources</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={field} onValueChange={(value) => onFieldChange(value as 'name' | 'time')}>
                    <DropdownMenuRadioItem value="time">Time</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Direction</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={direction} onValueChange={(value) => onDirectionChange(value as 'asc' | 'desc')}>
                    <DropdownMenuRadioItem value="desc">
                        <ArrowDown className="h-3.5 w-3.5" />
                        Descending
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="asc">
                        <ArrowUp className="h-3.5 w-3.5" />
                        Ascending
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const ResourceDetailsDialog: React.FC<{
    folder: ResourceFolderDetails | null;
    resource: CourseResourceFile | null;
    open: boolean;
    nameValue: string;
    urlValue: string;
    isSaving: boolean;
    onOpenChange: (open: boolean) => void;
    onNameChange: (value: string) => void;
    onUrlChange: (value: string) => void;
    onSave: () => void;
}> = ({ folder, resource, open, nameValue, urlValue, isSaving, onOpenChange, onNameChange, onUrlChange, onSave }) => {
    const isFolder = Boolean(folder);
    const isLinkResource = resource?.resource_kind === 'link';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{isFolder ? 'Folder details' : 'Resource details'}</DialogTitle>
                    <DialogDescription>
                        {isFolder ? 'Review the folder summary for this course.' : 'Review resource metadata and edit link details when available.'}
                    </DialogDescription>
                </DialogHeader>

                {folder ? (
                    <div className="space-y-4 text-sm">
                        <Field>
                            <FieldLabel>Name</FieldLabel>
                            <ReadonlyValue value={folder.course_name} />
                        </Field>
                        <Field>
                            <FieldLabel>Resources</FieldLabel>
                            <ReadonlyValue value={`${folder.files.length}`} />
                        </Field>
                        <Field>
                            <FieldLabel>Total size</FieldLabel>
                            <ReadonlyValue value={formatBytes(folder.files.reduce((sum, file) => sum + file.size_bytes, 0))} />
                        </Field>
                    </div>
                ) : resource ? (
                    <div className="space-y-4 text-sm">
                        <Field>
                            <FieldLabel>Name</FieldLabel>
                            <Input value={nameValue} onChange={(event) => onNameChange(event.target.value)} autoComplete="off" />
                        </Field>
                        {isLinkResource ? (
                            <Field>
                                <FieldLabel>URL</FieldLabel>
                                <Input value={urlValue} onChange={(event) => onUrlChange(event.target.value)} autoComplete="off" />
                            </Field>
                        ) : (
                            <Field>
                                <FieldLabel>Size</FieldLabel>
                                <ReadonlyValue value={formatBytes(resource.size_bytes)} />
                            </Field>
                        )}
                        <Field>
                            <FieldLabel>Updated</FieldLabel>
                            <ReadonlyValue value={formatTimestamp(resource.updated_at)} />
                        </Field>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Close
                    </Button>
                    {resource ? (
                        <Button type="button" onClick={onSave} disabled={!nameValue.trim() || (isLinkResource && !urlValue.trim()) || isSaving}>
                            {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Add resource dialog ──────────────────────────────────────────────────────

const AddResourceDialog: React.FC<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activeTab: 'files' | 'link';
    onTabChange: (tab: 'files' | 'link') => void;
    pendingFiles: File[];
    isDragging: boolean;
    onDragOver: React.DragEventHandler;
    onDragLeave: React.DragEventHandler;
    onDrop: React.DragEventHandler;
    onBrowseClick: () => void;
    onRemoveFile: (index: number) => void;
    linkUrl: string;
    onLinkUrlChange: (value: string) => void;
    linkName: string;
    onLinkNameChange: (value: string) => void;
    remainingBytes: number | undefined;
    isUploading: boolean;
    isSavingLink: boolean;
    onUpload: () => void;
    onSaveUrl: () => void;
}> = ({
    open, onOpenChange, activeTab, onTabChange,
    pendingFiles, isDragging, onDragOver, onDragLeave, onDrop, onBrowseClick, onRemoveFile,
    linkUrl, onLinkUrlChange, linkName, onLinkNameChange,
    remainingBytes, isUploading, isSavingLink, onUpload, onSaveUrl,
}) => {
    const isBusy = isUploading || isSavingLink;
    const totalIncoming = pendingFiles.reduce((sum, f) => sum + f.size, 0);
    const wouldExceedQuota = remainingBytes !== undefined && pendingFiles.length > 0 && totalIncoming > remainingBytes;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!isBusy) onOpenChange(next);
            }}
        >
            <DialogContent className="flex max-h-[min(80vh,600px)] flex-col overflow-hidden sm:max-w-[580px]">
                <DialogHeader>
                    <DialogTitle>Add resource</DialogTitle>
                    <DialogDescription>
                        Upload files or save a course URL for quick reuse. Script files are blocked; the 50 MB limit applies account-wide.
                    </DialogDescription>
                </DialogHeader>

                {/* Scrollable body — tab switcher + content */}
                <div className="min-h-0 flex-1 overflow-y-auto px-1">
                    <Tabs
                        value={activeTab}
                        onValueChange={(v) => onTabChange(v as 'files' | 'link')}
                        className="flex min-h-0 flex-1 flex-col gap-4"
                    >
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="files">Upload files</TabsTrigger>
                            <TabsTrigger value="link">Save URL</TabsTrigger>
                        </TabsList>

                        {/* Upload tab */}
                        <TabsContent value="files" className="mt-0 flex min-h-[280px] flex-col gap-4">
                            <button
                                type="button"
                                className={cn(
                                    'w-full cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all',
                                    isDragging
                                        ? 'border-primary bg-primary/5'
                                        : 'border-muted-foreground/25 hover:border-primary/50',
                                )}
                                onClick={onBrowseClick}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                            >
                                {pendingFiles.length > 0 ? (
                                    <div className="flex items-center justify-center gap-2 font-medium text-primary">
                                        <Upload className="h-5 w-5" />
                                        {pendingFiles.length} file{pendingFiles.length === 1 ? '' : 's'} selected
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Upload className="h-8 w-8 text-muted-foreground/50" />
                                        <span className="text-sm text-muted-foreground">Click or drag files to upload</span>
                                    </div>
                                )}
                            </button>
                            {remainingBytes !== undefined && (
                                <p className={cn('text-xs', wouldExceedQuota ? 'text-destructive' : 'text-muted-foreground')}>
                                    {wouldExceedQuota
                                        ? `Selection exceeds remaining storage (${formatBytes(remainingBytes)} left). Remove files to continue.`
                                        : `Remaining account storage: ${formatBytes(remainingBytes)} (may be slightly out of date)`}
                                </p>
                            )}
                            <UploadSelectionList files={pendingFiles} onRemove={onRemoveFile} />
                        </TabsContent>

                        {/* Save URL tab */}
                        <TabsContent value="link" className="mt-0 flex min-h-[280px] flex-col gap-4">
                            <Field>
                                <FieldLabel>URL</FieldLabel>
                                <FieldDescription>
                                    Paste any http/https URL — slides, recordings, forms, or external docs.
                                </FieldDescription>
                                <Input
                                    value={linkUrl}
                                    onChange={(e) => onLinkUrlChange(e.target.value)}
                                    placeholder="https://example.com/resource"
                                    autoComplete="off"
                                />
                            </Field>
                            <Field>
                                <FieldLabel>
                                    Display name
                                    <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
                                </FieldLabel>
                                <FieldDescription>
                                    Shown in the resource list instead of the raw URL.
                                </FieldDescription>
                                <Input
                                    value={linkName}
                                    onChange={(e) => onLinkNameChange(e.target.value)}
                                    placeholder="e.g. Week 3 Lecture Slides"
                                />
                            </Field>
                        </TabsContent>
                    </Tabs>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isBusy}
                    >
                        Cancel
                    </Button>
                    {activeTab === 'files' ? (
                        <Button
                            type="button"
                            onClick={onUpload}
                            disabled={pendingFiles.length === 0 || isUploading || wouldExceedQuota}
                        >
                            {isUploading
                                ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading…</>
                                : `Upload${pendingFiles.length > 0 ? ` ${pendingFiles.length}` : ''}`}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={onSaveUrl}
                            disabled={!linkUrl.trim() || isSavingLink}
                        >
                            {isSavingLink
                                ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                                : 'Save URL'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Main tab component ───────────────────────────────────────────────────────

const CourseResourcesTab: React.FC<TabProps> = ({ semesterId, courseId }) => {
    const queryClient = useQueryClient();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Determine view mode:
    // - semesterOnly: semesterId present, no courseId → show folder switcher
    // - courseView: courseId present → lock to single course folder
    const isSemesterView = Boolean(semesterId) && !courseId;
    const effectiveCourseId = courseId ?? null;

    // ── UI state (transient dialog form fields, preserved across remounts) ──

    const { state, setState: setResourceUiState } = usePluginUiState<CourseResourcesUiState>(
        'course-resources-dialog',
        () => ({
            activeUploadTab: 'files',
            linkUrl: '',
            linkName: '',
            sortOrder: DEFAULT_SORT_ORDER,
            selectedFolderId: '',
        }),
    );
    const sortOrder = resolveResourceSortOrder(state.sortOrder);
    const sortField = sortOrder === 'name_asc' || sortOrder === 'name_desc' ? 'name' : 'time';
    const sortDirection = sortOrder === 'name_asc' || sortOrder === 'oldest' ? 'asc' : 'desc';

    const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
    const [renamingResource, setRenamingResource] = React.useState<CourseResourceFile | null>(null);
    const [resourceToDelete, setResourceToDelete] = React.useState<CourseResourceFile | null>(null);
    const [detailsFolder, setDetailsFolder] = React.useState<ResourceFolderDetails | null>(null);
    const [detailsResource, setDetailsResource] = React.useState<CourseResourceFile | null>(null);
    const [externalResourceTarget, setExternalResourceTarget] = React.useState<ExternalResourceOpenTarget | null>(null);
    const [detailsNameValue, setDetailsNameValue] = React.useState('');
    const [detailsUrlValue, setDetailsUrlValue] = React.useState('');
    const [renameValue, setRenameValue] = React.useState('');

    // ── Data queries (private API — file data only) ──────────────────────────

    const semesterResourcesQuery = useQuery({
        queryKey: semesterId ? semesterKeys.resources(semesterId) : ['semester-resources', 'disabled'],
        queryFn: () => api.getSemesterResources(semesterId!),
        enabled: Boolean(semesterId),
        staleTime: 30_000,
    });

    const courseResourcesQuery = useQuery({
        queryKey: effectiveCourseId ? courseKeys.resources(effectiveCourseId) : ['course-resources', 'disabled'],
        queryFn: () => api.getCourseResources(effectiveCourseId!),
        enabled: Boolean(effectiveCourseId) && !isSemesterView,
        staleTime: 30_000,
    });
    const semesterDetailQuery = useSemesterQuery(semesterId);

    // ── Derived data for semester view ───────────────────────────────────────

    const semesterFolders = React.useMemo(
        () => semesterResourcesQuery.data?.course_folders ?? [],
        [semesterResourcesQuery.data?.course_folders],
    );
    const semesterName = semesterDetailQuery.data?.name?.trim() || 'Semester';

    // In semester view, empty selectedFolderId means "root directory".
    const selectedFolderId = React.useMemo(() => {
        if (!isSemesterView) return effectiveCourseId ?? '';
        if (!state.selectedFolderId) return '';
        return semesterFolders.some((f) => f.course_id === state.selectedFolderId) ? state.selectedFolderId : '';
    }, [isSemesterView, state.selectedFolderId, semesterFolders, effectiveCourseId]);

    const selectedFolder = React.useMemo(
        () => semesterFolders.find((folder) => folder.course_id === selectedFolderId) ?? null,
        [semesterFolders, selectedFolderId],
    );

    const activeFolderCourseId = isSemesterView ? (selectedFolder?.course_id ?? '') : (effectiveCourseId ?? '');

    // Files shown in the resource list (sorted)
    const displayedFiles = React.useMemo(() => {
        let rawFiles: CourseResourceFile[];
        if (isSemesterView) {
            rawFiles = selectedFolder?.files ?? [];
        } else {
            rawFiles = courseResourcesQuery.data?.files ?? [];
        }
        return sortFiles(rawFiles, sortOrder);
    }, [isSemesterView, selectedFolder, courseResourcesQuery.data, sortOrder]);

    // Quota from the active query
    const quotaData = isSemesterView ? semesterResourcesQuery.data : courseResourcesQuery.data;

    // ── Invalidate the active query key after any mutation ───────────────────

    const invalidateResources = React.useCallback(async () => {
        if (semesterId) {
            await queryClient.invalidateQueries({ queryKey: semesterKeys.resources(semesterId) });
        }
        if (activeFolderCourseId) {
            await queryClient.invalidateQueries({ queryKey: courseKeys.resources(activeFolderCourseId) });
        }
    }, [queryClient, semesterId, activeFolderCourseId]);

    // ── Mutations (private API — file operations only) ───────────────────────

    const resetUploadState = React.useCallback(() => {
        setPendingFiles([]);
        setIsDragging(false);
        setResourceUiState((current) => ({
            ...current,
            activeUploadTab: 'files',
            linkUrl: '',
            linkName: '',
        }));
    }, [setResourceUiState]);

    const uploadMutation = useMutation({
        mutationFn: (files: File[]) => api.uploadCourseResources(activeFolderCourseId, files),
        onSuccess: async (response) => {
            await invalidateResources();
            resetUploadState();
            setIsUploadDialogOpen(false);
            if (response.uploaded_files.length > 0) {
                toast.success(`Uploaded ${response.uploaded_files.length} file${response.uploaded_files.length === 1 ? '' : 's'}.`);
            }
            if (response.failed_files.length > 0) {
                toast.error(response.failed_files[0]?.message || 'Some files could not be uploaded.');
            }
        },
        onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, 'Failed to upload course resources.'));
        },
    });

    const createLinkMutation = useMutation({
        mutationFn: () => api.createCourseResourceLink(activeFolderCourseId, {
            url: state.linkUrl.trim(),
            filename_display: state.linkName.trim() || undefined,
        }),
        onSuccess: async () => {
            await invalidateResources();
            resetUploadState();
            setIsUploadDialogOpen(false);
            toast.success('URL saved.');
        },
        onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, 'Failed to save URL.'));
        },
    });

    const updateResourceMutation = useMutation({
        mutationFn: ({ resourceId, data }: { resourceId: string; data: { filename_display?: string; url?: string } }) =>
            api.updateCourseResource(activeFolderCourseId, resourceId, data),
        onSuccess: async () => {
            await invalidateResources();
        },
        onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, 'Failed to update resource.'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (resourceId: string) => api.deleteCourseResource(activeFolderCourseId, resourceId),
        onSuccess: async () => {
            await invalidateResources();
            setResourceToDelete(null);
            toast.success('Resource deleted.');
        },
        onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, 'Failed to delete resource.'));
        },
    });

    // ── File staging helpers ─────────────────────────────────────────────────

    const appendFiles = React.useCallback((list: FileList | null) => {
        if (!list || list.length === 0) return;
        const files = Array.from(list);
        if (files.some(isBlockedUploadFile)) {
            toast.error(SCRIPT_FILE_MESSAGE);
            return;
        }
        setPendingFiles((prev) => [...prev, ...files]);
    }, []);

    const submitPendingFiles = React.useCallback(() => {
        if (!activeFolderCourseId || pendingFiles.length === 0) return;
        const remaining = quotaData?.remaining_bytes ?? 0;
        const totalIncoming = pendingFiles.reduce((sum, f) => sum + f.size, 0);
        if (quotaData && totalIncoming > remaining) {
            toast.error(RESOURCE_LIMIT_MESSAGE);
            return;
        }
        uploadMutation.mutate(pendingFiles);
    }, [activeFolderCourseId, pendingFiles, quotaData, uploadMutation]);

    // ── Rename helpers ───────────────────────────────────────────────────────

    const openRenameDialog = React.useCallback((resource: CourseResourceFile) => {
        setRenamingResource(resource);
        setRenameValue(resource.filename_display);
    }, []);

    const submitRename = React.useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (!renamingResource) return;
        try {
            await updateResourceMutation.mutateAsync({
                resourceId: renamingResource.id,
                data: { filename_display: renameValue.trim() },
            });
            setRenamingResource(null);
        } catch {
            // Error is surfaced via the mutation's onError toast handler
        }
    }, [updateResourceMutation, renameValue, renamingResource]);

    const openResourceDetailsDialog = React.useCallback((resource: CourseResourceFile) => {
        setDetailsFolder(null);
        setDetailsResource(resource);
        setDetailsNameValue(resource.filename_display);
        setDetailsUrlValue(resource.external_url ?? '');
    }, []);

    const openFolderDetailsDialog = React.useCallback((folder: ResourceFolderDetails) => {
        setDetailsResource(null);
        setDetailsFolder(folder);
        setDetailsNameValue(folder.course_name);
        setDetailsUrlValue('');
    }, []);

    const closeDetailsDialog = React.useCallback((open: boolean) => {
        if (open) return;
        setDetailsFolder(null);
        setDetailsResource(null);
        setDetailsNameValue('');
        setDetailsUrlValue('');
    }, []);

    const submitResourceDetails = React.useCallback(async () => {
        if (!detailsResource) return;
        try {
            await updateResourceMutation.mutateAsync({
                resourceId: detailsResource.id,
                data: {
                    filename_display: detailsNameValue.trim(),
                    url: detailsResource.resource_kind === 'link' ? detailsUrlValue.trim() : undefined,
                },
            });
            setDetailsResource(null);
            setDetailsNameValue('');
            setDetailsUrlValue('');
        } catch {
            // Error is surfaced via the mutation's onError toast handler
        }
    }, [detailsNameValue, detailsResource, detailsUrlValue, updateResourceMutation]);

    const requestExternalResourceOpen = React.useCallback((resource: CourseResourceFile, url: string) => {
        setExternalResourceTarget({ name: resource.filename_display, url });
    }, []);

    const confirmExternalResourceOpen = React.useCallback(() => {
        if (!externalResourceTarget) return;
        window.open(externalResourceTarget.url, '_blank', 'noopener,noreferrer');
        setExternalResourceTarget(null);
    }, [externalResourceTarget]);

    // ── Empty / error context guards ─────────────────────────────────────────

    // Hidden file input — rendered once at tab root, triggered via fileInputRef.current.click()
    const hiddenFileInput = (
        <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
                appendFiles(event.target.files);
                event.currentTarget.value = '';
            }}
        />
    );

    if (!semesterId && !courseId) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Course resources unavailable"
                description="This tab requires a course or semester context."
            />
        );
    }

    if (isSemesterView && semesterResourcesQuery.status === 'success' && semesterFolders.length === 0) {
        return (
            <div className="flex h-full flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <QuotaBadge status="success" totalBytesUsed={0} totalBytesLimit={quotaData?.total_bytes_limit} />
                </div>
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    title="No courses in this semester"
                    description="Add courses to this semester before uploading resources."
                />
            </div>
        );
    }

    const isMutating = uploadMutation.isPending || createLinkMutation.isPending;
    const isListLoading = isSemesterView ? semesterResourcesQuery.isLoading : courseResourcesQuery.isLoading;
    const isListError = isSemesterView ? Boolean(semesterResourcesQuery.error) : Boolean(courseResourcesQuery.error);

    // ── Single return: content switches by isSemesterView; dialogs shared once ─

    return (
        <>
            {hiddenFileInput}
            <div className="flex h-full flex-col gap-4">
                {isSemesterView ? (
                    isListLoading ? (
                        <div className="space-y-2">
                            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                        </div>
                    ) : (
                        <div className="flex min-h-0 flex-1 flex-col gap-4">
                            <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <Breadcrumb>
                                        <BreadcrumbList className="text-sm">
                                            <BreadcrumbItem>
                                                {selectedFolder ? (
                                                    <BreadcrumbLink asChild>
                                                        <button
                                                            type="button"
                                                            onClick={() => setResourceUiState((current) => ({ ...current, selectedFolderId: '' }))}
                                                        >
                                                            {semesterName}
                                                        </button>
                                                    </BreadcrumbLink>
                                                ) : (
                                                    <BreadcrumbPage>{semesterName}</BreadcrumbPage>
                                                )}
                                            </BreadcrumbItem>
                                            {selectedFolder ? (
                                                <>
                                                    <BreadcrumbSeparator />
                                                    <BreadcrumbItem>
                                                        <BreadcrumbPage>{selectedFolder.course_name}</BreadcrumbPage>
                                                    </BreadcrumbItem>
                                                </>
                                            ) : null}
                                        </BreadcrumbList>
                                    </Breadcrumb>
                                </div>

                                <div className="flex min-h-9 items-center gap-2">
                                    <div className="flex h-9 items-center rounded-md border border-border/60 bg-background px-2.5">
                                        <QuotaBadge
                                            status={semesterResourcesQuery.status}
                                            totalBytesUsed={quotaData?.total_bytes_used}
                                            totalBytesLimit={quotaData?.total_bytes_limit}
                                        />
                                    </div>
                                    {selectedFolder ? (
                                        <>
                                            <SortMenu
                                                field={sortField}
                                                direction={sortDirection}
                                                onFieldChange={(field) => {
                                                    setResourceUiState((current) => ({
                                                        ...current,
                                                        sortOrder: field === 'name'
                                                            ? (sortDirection === 'asc' ? 'name_asc' : 'name_desc')
                                                            : (sortDirection === 'asc' ? 'oldest' : 'newest'),
                                                    }));
                                                }}
                                                onDirectionChange={(direction) => {
                                                    setResourceUiState((current) => ({
                                                        ...current,
                                                        sortOrder: sortField === 'name'
                                                            ? (direction === 'asc' ? 'name_asc' : 'name_desc')
                                                            : (direction === 'asc' ? 'oldest' : 'newest'),
                                                    }));
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                className="h-9"
                                                onClick={() => setIsUploadDialogOpen(true)}
                                                disabled={isMutating || !selectedFolder}
                                            >
                                                {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                Add resource
                                            </Button>
                                        </>
                                    ) : null}
                                </div>
                            </div>

                            <div className="min-h-0 flex-1">
                                {selectedFolder ? (
                                    <SemesterResourceExplorerList
                                        courseId={selectedFolder.course_id}
                                        files={displayedFiles}
                                        isLoading={false}
                                        isError={isListError}
                                        onRetry={() => void semesterResourcesQuery.refetch()}
                                        onAdd={() => setIsUploadDialogOpen(true)}
                                        onRename={openRenameDialog}
                                        onDelete={setResourceToDelete}
                                        onDetails={openResourceDetailsDialog}
                                        onOpenExternalResource={(resource, url) => void requestExternalResourceOpen(resource, url)}
                                    />
                                ) : isListError ? (
                                    <AppEmptyState
                                        scenario="unavailable"
                                        size="section"
                                        title="Unable to load course folders"
                                        description="The semester resource folders could not be loaded."
                                        primaryAction={<Button type="button" onClick={() => void semesterResourcesQuery.refetch()}>Retry</Button>}
                                    />
                                ) : (
                                    <CourseFolderList
                                        folders={semesterFolders}
                                        onSelect={(id) => {
                                            setResourceUiState((current) => ({ ...current, selectedFolderId: id }));
                                        }}
                                        onDetails={openFolderDetailsDialog}
                                    />
                                )}
                            </div>
                        </div>
                    )
                ) : (
                    <>
                        <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
                            <div />
                            <div className="flex min-h-9 items-center gap-2">
                                <div className="flex h-9 items-center rounded-md border border-border/60 bg-background px-2.5">
                                    <QuotaBadge
                                        status={courseResourcesQuery.status}
                                        totalBytesUsed={quotaData?.total_bytes_used}
                                        totalBytesLimit={quotaData?.total_bytes_limit}
                                    />
                                </div>
                                <SortMenu
                                    field={sortField}
                                    direction={sortDirection}
                                    onFieldChange={(field) => {
                                        setResourceUiState((current) => ({
                                            ...current,
                                            sortOrder: field === 'name'
                                                ? (sortDirection === 'asc' ? 'name_asc' : 'name_desc')
                                                : (sortDirection === 'asc' ? 'oldest' : 'newest'),
                                        }));
                                    }}
                                    onDirectionChange={(direction) => {
                                        setResourceUiState((current) => ({
                                            ...current,
                                            sortOrder: sortField === 'name'
                                                ? (direction === 'asc' ? 'name_asc' : 'name_desc')
                                                : (direction === 'asc' ? 'oldest' : 'newest'),
                                        }));
                                    }}
                                />
                                <Button
                                    type="button"
                                    className="h-9"
                                    onClick={() => setIsUploadDialogOpen(true)}
                                    disabled={isMutating}
                                >
                                    {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    Add resource
                                </Button>
                            </div>
                        </div>

                        <SemesterResourceExplorerList
                            courseId={effectiveCourseId!}
                            files={displayedFiles}
                            isLoading={isListLoading}
                            isError={isListError}
                            onRetry={() => void courseResourcesQuery.refetch()}
                            onAdd={() => setIsUploadDialogOpen(true)}
                            onRename={openRenameDialog}
                            onDelete={setResourceToDelete}
                            onDetails={openResourceDetailsDialog}
                            onOpenExternalResource={(resource, url) => void requestExternalResourceOpen(resource, url)}
                        />
                    </>
                )}
            </div>

            {/* ── Shared dialogs ──────────────────────────────────────────────── */}
            <AddResourceDialog
                open={isUploadDialogOpen}
                onOpenChange={setIsUploadDialogOpen}
                activeTab={state.activeUploadTab}
                onTabChange={(tab) => setResourceUiState((s) => ({ ...s, activeUploadTab: tab }))}
                pendingFiles={pendingFiles}
                isDragging={isDragging}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); appendFiles(e.dataTransfer.files); }}
                onBrowseClick={() => fileInputRef.current?.click()}
                onRemoveFile={(i) => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                linkUrl={state.linkUrl}
                onLinkUrlChange={(v) => setResourceUiState((s) => ({ ...s, linkUrl: v }))}
                linkName={state.linkName}
                onLinkNameChange={(v) => setResourceUiState((s) => ({ ...s, linkName: v }))}
                remainingBytes={quotaData?.remaining_bytes}
                isUploading={uploadMutation.isPending}
                isSavingLink={createLinkMutation.isPending}
                onUpload={submitPendingFiles}
                onSaveUrl={() => createLinkMutation.mutate()}
            />

            {/* Rename dialog */}
            <Dialog open={Boolean(renamingResource)} onOpenChange={(open) => !open && setRenamingResource(null)}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>Rename resource</DialogTitle>
                        <DialogDescription>Update the display name used inside Course Resources.</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={submitRename}>
                        <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            placeholder="Resource name"
                            autoFocus
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRenamingResource(null)} disabled={updateResourceMutation.isPending}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!renameValue.trim() || updateResourceMutation.isPending}>
                                {updateResourceMutation.isPending ? 'Saving…' : 'Save'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ResourceDetailsDialog
                folder={detailsFolder}
                resource={detailsResource}
                open={Boolean(detailsFolder || detailsResource)}
                nameValue={detailsNameValue}
                urlValue={detailsUrlValue}
                isSaving={updateResourceMutation.isPending}
                onOpenChange={closeDetailsDialog}
                onNameChange={setDetailsNameValue}
                onUrlChange={setDetailsUrlValue}
                onSave={() => void submitResourceDetails()}
            />

            <ExternalResourceConfirmDialog
                target={externalResourceTarget}
                onOpenChange={(open) => {
                    if (!open) setExternalResourceTarget(null);
                }}
                onConfirm={confirmExternalResourceOpen}
            />

            <AlertDialog open={Boolean(resourceToDelete)} onOpenChange={(open) => !open && setResourceToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete resource?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {resourceToDelete
                                ? `This will permanently remove "${resourceToDelete.filename_display}" from Course Resources.`
                                : 'This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => { if (resourceToDelete) deleteMutation.mutate(resourceToDelete.id); }}
                        >
                            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export const CourseResourcesTabDefinition: TabDefinition = {
    type: COURSE_RESOURCES_TAB_TYPE,
    component: CourseResourcesTab,
};
