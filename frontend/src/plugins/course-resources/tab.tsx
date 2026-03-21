// input:  [course resource API/query state, course tab context ids, dialog primitives, tabs UI, and shared action components]
// output: [`CourseResourcesTabDefinition` and the course-resources tab runtime component]
// pos:    [course-scoped resource manager tab with account-quota-aware uploads, lower-height stable dialog tabs, footer-aligned actions, saved-link support, and lightweight file actions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Download,
    File,
    FileArchive,
    FileAudio,
    FileCode2,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileVideo,
    Link2,
    Loader2,
    Pencil,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api, { type CourseResourceFile } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import type { TabDefinition, TabProps } from '@/services/tabRegistry';

import {
    COURSE_RESOURCES_TAB_TYPE,
    formatBytes,
    formatTimestamp,
    getResourceExtensionLabel,
    resolveCourseResourceHref,
} from './shared';

const RESOURCE_LIMIT_MESSAGE = 'Uploading these files would exceed the 50MB account resource limit.';
const SCRIPT_FILE_MESSAGE = 'Script files are not allowed. Remove .sh, .bat, .ps1, .cmd, and similar executable files.';
const BLOCKED_UPLOAD_EXTENSIONS = new Set([
    '.bat',
    '.bash',
    '.cmd',
    '.com',
    '.csh',
    '.ksh',
    '.ps1',
    '.psm1',
    '.py',
    '.rb',
    '.sh',
    '.vbs',
    '.zsh',
]);

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

const isBlockedUploadFile = (file: File) => {
    const lastDot = file.name.lastIndexOf('.');
    const suffix = lastDot >= 0 ? file.name.slice(lastDot).toLowerCase() : '';
    return BLOCKED_UPLOAD_EXTENSIONS.has(suffix);
};

const ResourceRow: React.FC<{
    courseId: string;
    resource: CourseResourceFile;
    onRename: (resource: CourseResourceFile) => void;
    onDelete: (resource: CourseResourceFile) => void;
}> = ({ courseId, resource, onRename, onDelete }) => {
    const openUrl = resolveCourseResourceHref(courseId, resource);
    const ResourceIcon = getResourceIcon(resource);

    return (
        <div className="flex flex-col gap-3 rounded-2xl bg-muted/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-background text-muted-foreground">
                        <ResourceIcon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <a
                                href={openUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-primary"
                            >
                                {resource.filename_display}
                            </a>
                            {resource.resource_kind === 'link' ? (
                                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Saved link only" />
                            ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{resource.resource_kind === 'link' ? 'Saved URL' : getResourceExtensionLabel(resource)}</span>
                            <span>{resource.resource_kind === 'link' ? 'No local file' : formatBytes(resource.size_bytes)}</span>
                            <span>Updated {formatTimestamp(resource.updated_at)}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {resource.resource_kind === 'file' ? (
                    <Button type="button" variant="secondary" size="sm" asChild>
                        <a href={api.buildCourseResourceOpenUrl(courseId, resource.id, { download: true })} target="_blank" rel="noreferrer">
                            <Download className="h-3.5 w-3.5" />
                            Download
                        </a>
                    </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={() => onRename(resource)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Rename
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(resource)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                </Button>
            </div>
        </div>
    );
};

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

const CourseResourcesTab: React.FC<TabProps> = ({ courseId }) => {
    const queryClient = useQueryClient();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
    const [activeUploadTab, setActiveUploadTab] = React.useState<'files' | 'link'>('files');
    const [isDragging, setIsDragging] = React.useState(false);
    const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
    const [linkUrl, setLinkUrl] = React.useState('');
    const [linkName, setLinkName] = React.useState('');
    const [renamingResource, setRenamingResource] = React.useState<CourseResourceFile | null>(null);
    const [resourceToDelete, setResourceToDelete] = React.useState<CourseResourceFile | null>(null);
    const [renameValue, setRenameValue] = React.useState('');

    const resourcesQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.resources(courseId) : ['courses', 'resources', 'disabled'],
        queryFn: () => api.getCourseResources(courseId!),
        enabled: Boolean(courseId),
        staleTime: 30_000,
    });

    const uploadMutation = useMutation({
        mutationFn: async (files: File[]) => api.uploadCourseResources(courseId!, files),
        onSuccess: async (response) => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.courses.resources(courseId!) });
            setPendingFiles([]);
            setIsUploadDialogOpen(false);
            if (response.uploaded_files.length > 0) {
                toast.success(`Uploaded ${response.uploaded_files.length} file${response.uploaded_files.length === 1 ? '' : 's'}.`);
            }
            if (response.failed_files.length > 0) {
                toast.error(response.failed_files[0]?.message || 'Some files could not be uploaded.');
            }
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail?.message ?? error?.message ?? 'Failed to upload course resources.');
        },
    });

    const createLinkMutation = useMutation({
        mutationFn: async () => api.createCourseResourceLink(courseId!, {
            url: linkUrl.trim(),
            filename_display: linkName.trim() || undefined,
        }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.courses.resources(courseId!) });
            setLinkUrl('');
            setLinkName('');
            setIsUploadDialogOpen(false);
            toast.success('URL saved.');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail?.message ?? error?.message ?? 'Failed to save URL.');
        },
    });

    const renameMutation = useMutation({
        mutationFn: async ({ resourceId, filenameDisplay }: { resourceId: string; filenameDisplay: string }) => (
            api.renameCourseResource(courseId!, resourceId, { filename_display: filenameDisplay })
        ),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.courses.resources(courseId!) });
            toast.success('Resource renamed.');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail?.message ?? error?.message ?? 'Failed to rename resource.');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (resourceId: string) => api.deleteCourseResource(courseId!, resourceId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.courses.resources(courseId!) });
            setResourceToDelete(null);
            toast.success('Resource deleted.');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail?.message ?? error?.message ?? 'Failed to delete resource.');
        },
    });

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
        if (!courseId || pendingFiles.length === 0) return;
        const remainingBytes = resourcesQuery.data?.remaining_bytes ?? 0;
        const totalIncoming = pendingFiles.reduce((sum, file) => sum + file.size, 0);
        if (resourcesQuery.data && totalIncoming > remainingBytes) {
            toast.error(RESOURCE_LIMIT_MESSAGE);
            return;
        }
        uploadMutation.mutate(pendingFiles);
    }, [courseId, pendingFiles, resourcesQuery.data, uploadMutation]);

    const removePendingFile = React.useCallback((index: number) => {
        setPendingFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    }, []);

    const resetUploadState = React.useCallback(() => {
        setPendingFiles([]);
        setLinkUrl('');
        setLinkName('');
        setIsDragging(false);
        setActiveUploadTab('files');
    }, []);

    const openRenameDialog = React.useCallback((resource: CourseResourceFile) => {
        setRenamingResource(resource);
        setRenameValue(resource.filename_display);
    }, []);

    const submitRename = React.useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (!renamingResource) return;
        await renameMutation.mutateAsync({
            resourceId: renamingResource.id,
            filenameDisplay: renameValue.trim(),
        });
        setRenamingResource(null);
    }, [renameMutation, renameValue, renamingResource]);

    if (!courseId) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Course resources unavailable"
                description="This tab requires a course context."
            />
        );
    }

    const quota = resourcesQuery.data;
    const isBusy = uploadMutation.isPending || createLinkMutation.isPending || renameMutation.isPending || deleteMutation.isPending;

    return (
        <>
            <div className="flex h-full flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="rounded-full bg-muted px-3.5 py-2 text-xs font-medium text-muted-foreground">
                        {quota ? `${formatBytes(quota.total_bytes_used)} used of ${formatBytes(quota.total_bytes_limit)}` : 'Loading quota...'}
                    </div>
                    <Button type="button" onClick={() => setIsUploadDialogOpen(true)} disabled={uploadMutation.isPending || createLinkMutation.isPending}>
                        {(uploadMutation.isPending || createLinkMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Add resource
                    </Button>
                </div>

                {resourcesQuery.isLoading ? (
                    <div className="space-y-3">
                        {[0, 1, 2].map((index) => (
                            <Skeleton key={index} className="h-24 rounded-2xl" />
                        ))}
                    </div>
                ) : resourcesQuery.error ? (
                    <AppEmptyState
                        scenario="unavailable"
                        size="section"
                        title="Unable to load course resources"
                        description="The latest resource list could not be loaded."
                        primaryAction={(
                            <Button type="button" onClick={() => void resourcesQuery.refetch()}>
                                Retry
                            </Button>
                        )}
                    />
                ) : quota && quota.files.length === 0 ? (
                    <AppEmptyState
                        scenario="create"
                        size="section"
                        title="No resources yet"
                        description="Add files or save a URL to build a reusable resource shelf for this course."
                        primaryAction={(
                            <Button type="button" onClick={() => setIsUploadDialogOpen(true)}>
                                <Upload className="h-4 w-4" />
                                Add resource
                            </Button>
                        )}
                    />
                ) : (
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <div className="max-h-[min(68vh,720px)] space-y-3 overflow-y-auto pr-1">
                            {quota?.files.map((resource) => (
                                <ResourceRow
                                    key={resource.id}
                                    courseId={courseId}
                                    resource={resource}
                                    onRename={openRenameDialog}
                                    onDelete={setResourceToDelete}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <Dialog
                open={isUploadDialogOpen}
                onOpenChange={(open) => {
                    setIsUploadDialogOpen(open);
                    if (!open && !uploadMutation.isPending && !createLinkMutation.isPending) {
                        resetUploadState();
                    }
                }}
            >
                <DialogContent className="flex max-h-[min(76vh,560px)] flex-col sm:max-w-[580px]">
                    <DialogHeader>
                        <DialogTitle>Add resource</DialogTitle>
                        <DialogDescription>
                            Upload multiple files with drag and drop, or save a course URL without storing the file locally. Script files are blocked and the 50MB limit applies to your whole account.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs
                        value={activeUploadTab}
                        onValueChange={(value) => setActiveUploadTab(value as 'files' | 'link')}
                        className="min-h-0 flex-1 gap-4"
                    >
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="files">Upload files</TabsTrigger>
                            <TabsTrigger value="link">Save URL</TabsTrigger>
                        </TabsList>

                        <div className="min-h-0 flex-1">
                            <TabsContent value="files" className="mt-0 h-full">
                                <div className="flex h-full min-h-[300px] flex-col gap-4">
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
                                    <button
                                        type="button"
                                        className={`w-full cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all ${
                                            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                                        }`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(event) => {
                                            event.preventDefault();
                                            setIsDragging(true);
                                        }}
                                        onDragLeave={(event) => {
                                            event.preventDefault();
                                            setIsDragging(false);
                                        }}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            setIsDragging(false);
                                            appendFiles(event.dataTransfer.files);
                                        }}
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            {pendingFiles.length > 0 ? (
                                                <div className="flex items-center gap-2 font-medium text-primary">
                                                    <Upload className="h-5 w-5" />
                                                    {pendingFiles.length} file{pendingFiles.length === 1 ? '' : 's'} selected
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload className="h-8 w-8 text-muted-foreground/50" />
                                                    <div className="text-sm text-muted-foreground">
                                                        Click or drag files to upload
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </button>
                                    <p className="text-sm text-muted-foreground">
                                        Remaining account storage: {quota ? formatBytes(quota.remaining_bytes) : '...'}
                                    </p>
                                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                        <UploadSelectionList files={pendingFiles} onRemove={removePendingFile} />
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="link" className="mt-0 h-full">
                                <div className="flex h-full min-h-[300px] flex-col gap-4">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-foreground">Save a course URL</p>
                                        <p className="text-sm text-muted-foreground">
                                            Use this for slides, docs, recordings, forms, or any external resource you want to reopen from this list.
                                        </p>
                                    </div>
                                    <Input
                                        value={linkUrl}
                                        onChange={(event) => setLinkUrl(event.target.value)}
                                        placeholder="https://example.com/resource"
                                    />
                                    <Input
                                        value={linkName}
                                        onChange={(event) => setLinkName(event.target.value)}
                                        placeholder="Optional display name"
                                    />
                                    <div className="flex-1" />
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="secondary"
                            className="w-full sm:w-auto"
                            onClick={() => {
                                setIsUploadDialogOpen(false);
                                resetUploadState();
                            }}
                            disabled={uploadMutation.isPending || createLinkMutation.isPending}
                        >
                            Close
                        </Button>
                        {activeUploadTab === 'files' ? (
                            <Button
                                type="button"
                                className="w-full sm:w-auto"
                                onClick={submitPendingFiles}
                                disabled={pendingFiles.length === 0 || uploadMutation.isPending}
                            >
                                {uploadMutation.isPending ? 'Uploading...' : `Upload ${pendingFiles.length > 0 ? pendingFiles.length : ''}`.trim()}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                className="w-full sm:w-auto"
                                onClick={() => createLinkMutation.mutate()}
                                disabled={!linkUrl.trim() || createLinkMutation.isPending}
                            >
                                {createLinkMutation.isPending ? 'Saving...' : 'Save URL'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(renamingResource)} onOpenChange={(open) => !open && setRenamingResource(null)}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>Rename resource</DialogTitle>
                        <DialogDescription>Update the display name used inside Course Resources.</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={submitRename}>
                        <Input
                            value={renameValue}
                            onChange={(event) => setRenameValue(event.target.value)}
                            placeholder="Resource name"
                            autoFocus
                        />
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setRenamingResource(null)} disabled={isBusy}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!renameValue.trim() || renameMutation.isPending}>
                                {renameMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

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
                            onClick={() => {
                                if (resourceToDelete) {
                                    deleteMutation.mutate(resourceToDelete.id);
                                }
                            }}
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
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
    defaultSettings: {},
};
