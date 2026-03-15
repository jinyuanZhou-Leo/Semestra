// input:  [TanStack Query, LMS API service, CRUD panel/table helpers, responsive dialog wrapper, shadcn field/dialog primitives, alert-dialog primitives, dialog-context alerts, and provider-specific LMS assets]
// output: [`LmsIntegrationManager` component]
// pos:    [settings-specific management surface for multiple saved LMS integrations with CRUD-table listing, icon-based row actions, save-time validation, and dialog-based create/edit/delete flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Check, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';
import { CrudPanel } from '@/components/CrudPanel';
import { ResponsiveDialogDrawer } from '@/components/ResponsiveDialogDrawer';
import { useDialog } from '@/contexts/DialogContext';
import api, { type LmsIntegrationResponse } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import canvasLogo from '@/assets/canvas-icon.png';
import { cn } from '@/lib/utils';

type SupportedProvider = 'canvas';

interface ProviderDefinition {
  value: SupportedProvider;
  label: string;
  logoSrc: string;
  logoAlt: string;
  instanceUrlLabel: string;
  instanceUrlPlaceholder: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  description: string;
}

const LMS_PROVIDER_DEFINITIONS: Record<SupportedProvider, ProviderDefinition> = {
  canvas: {
    value: 'canvas',
    label: 'Canvas',
    logoSrc: canvasLogo,
    logoAlt: 'Canvas',
    instanceUrlLabel: 'Instance URL',
    instanceUrlPlaceholder: 'https://canvas.instructure.com/',
    apiKeyLabel: 'API Key',
    apiKeyPlaceholder: 'Paste Canvas API key',
    description: 'Reusable Canvas connections for Program-level LMS binding and Course linking.',
  },
};

interface DraftState {
  id: string | null;
  provider: SupportedProvider;
  displayName: string;
  instanceUrl: string;
  apiKey: string;
  isEditingApiKey: boolean;
  hasApiKeyChange: boolean;
  maskedApiKey: string;
}

const EMPTY_DRAFT: DraftState = {
  id: null,
  provider: 'canvas',
  displayName: '',
  instanceUrl: '',
  apiKey: '',
  isEditingApiKey: false,
  hasApiKeyChange: false,
  maskedApiKey: '',
};

const normalizeCanvasBaseUrl = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!parsed.hostname || parsed.search || parsed.hash) return null;
    if (parsed.pathname.replace(/\/+$/, '') === '/api/v1') return null;
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  } catch {
    return null;
  }
};

const validateCanvasApiKey = (value: string) => {
  if (!value) return false;
  if (value.includes('@') || /\s/.test(value)) return false;
  return value.length >= 8;
};

const resolveInlineApiErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    if (detail && typeof detail === 'object') {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
  }
  return fallback;
};

const getProviderDefinition = (provider: string | SupportedProvider): ProviderDefinition => {
  if (provider in LMS_PROVIDER_DEFINITIONS) {
    return LMS_PROVIDER_DEFINITIONS[provider as SupportedProvider];
  }
  return LMS_PROVIDER_DEFINITIONS.canvas;
};

const normalizeInstanceUrl = (provider: SupportedProvider, value: string) => {
  switch (provider) {
    case 'canvas':
      return normalizeCanvasBaseUrl(value);
    default:
      return null;
  }
};

const validateApiKey = (provider: SupportedProvider, value: string) => {
  switch (provider) {
    case 'canvas':
      return validateCanvasApiKey(value);
    default:
      return false;
  }
};

const maskApiKey = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const visiblePrefix = trimmed.slice(0, 4);
  const hiddenLength = Math.max(4, trimmed.length - visiblePrefix.length);
  return `${visiblePrefix}${'*'.repeat(hiddenLength)}`;
};

const getIntegrationInstanceUrl = (integration: LmsIntegrationResponse) => (
  typeof integration.config?.base_url === 'string' ? integration.config.base_url : ''
);

export const LmsIntegrationManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { alert } = useDialog();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeleteIntegration, setPendingDeleteIntegration] = useState<LmsIntegrationResponse | null>(null);
  const [revalidatingIntegrationId, setRevalidatingIntegrationId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [touched, setTouched] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState('');
  const integrationsQuery = useQuery({
    queryKey: queryKeys.user.lmsIntegrations(),
    queryFn: api.listLmsIntegrations,
  });

  const createMutation = useMutation({
    mutationFn: api.createLmsIntegration,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.user.lmsIntegrations() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ integrationId, payload }: { integrationId: string; payload: Parameters<typeof api.updateLmsIntegration>[1] }) => (
      api.updateLmsIntegration(integrationId, payload)
    ),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.user.lmsIntegrations() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.user.lmsIntegration(variables.integrationId) }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteLmsIntegration,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.user.lmsIntegrations() });
    },
  });

  const validateDraftMutation = useMutation({
    mutationFn: api.validateLmsIntegrationDraft,
  });

  const validateSavedMutation = useMutation({
    mutationFn: api.validateSavedLmsIntegration,
    onSuccess: async (_, integrationId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.user.lmsIntegrations() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.user.lmsIntegration(integrationId) }),
      ]);
    },
  });

  const providerDefinition = useMemo(
    () => getProviderDefinition(draft.provider),
    [draft.provider],
  );
  const selectedIntegration = useMemo(
    () => integrationsQuery.data?.find((item) => item.id === draft.id) ?? null,
    [draft.id, integrationsQuery.data],
  );
  const selectedInstanceUrl = selectedIntegration ? getIntegrationInstanceUrl(selectedIntegration) : '';
  const normalizedApiKey = draft.apiKey.trim();
  const normalizedInstanceUrl = normalizeInstanceUrl(draft.provider, draft.instanceUrl.trim());
  const displayNameValid = draft.displayName.trim().length > 0;
  const apiKeyValid = validateApiKey(draft.provider, normalizedApiKey);
  const displayedMaskedApiKey = draft.hasApiKeyChange ? maskApiKey(normalizedApiKey) : draft.maskedApiKey;
  const instanceUrlInvalid = touched && Boolean(draft.instanceUrl.trim()) && !normalizedInstanceUrl;
  const apiKeyInvalid = touched && Boolean(normalizedApiKey) && !apiKeyValid;
  const isBusy = createMutation.isPending
    || updateMutation.isPending
    || deleteMutation.isPending
    || validateDraftMutation.isPending
    || validateSavedMutation.isPending;

  useEffect(() => {
    if (draft.id === null || selectedIntegration) return;
    setDialogOpen(false);
    setDraft(EMPTY_DRAFT);
    setTouched(false);
    setSaveErrorMessage('');
  }, [draft.id, selectedIntegration]);

  const resetFeedback = () => {
    setSaveErrorMessage('');
  };

  const openCreateDialog = () => {
    setDraft(EMPTY_DRAFT);
    setTouched(false);
    resetFeedback();
    setDialogOpen(true);
  };

  const openEditDialog = (integration: LmsIntegrationResponse) => {
    setDraft({
      id: integration.id,
      provider: integration.provider as SupportedProvider,
      displayName: integration.display_name,
      instanceUrl: getIntegrationInstanceUrl(integration),
      apiKey: '',
      isEditingApiKey: false,
      hasApiKeyChange: false,
      maskedApiKey: integration.masked_api_key ?? '',
    });
    setTouched(false);
    resetFeedback();
    setDialogOpen(true);
  };

  const closeDialog = (open: boolean) => {
    if (isBusy) return;
    setDialogOpen(open);
    if (!open) {
      setTouched(false);
      setSaveErrorMessage('');
    }
  };

  const handleValidateSaved = async (integration: LmsIntegrationResponse) => {
    setRevalidatingIntegrationId(integration.id);
    try {
      await validateSavedMutation.mutateAsync(integration.id);
    } catch (error) {
      const failureMessage = resolveInlineApiErrorMessage(error, 'LMS validation failed.');
      void alert({
        title: 'Validation failed',
        description: failureMessage,
        confirmText: 'OK',
      });
    } finally {
      setRevalidatingIntegrationId(null);
    }
  };

  const handleSave = async () => {
    setTouched(true);
    setSaveErrorMessage('');

    if (!displayNameValid) {
      setSaveErrorMessage('Integration name is required.');
      return;
    }

    const instanceUrlChanged = normalizedInstanceUrl !== selectedInstanceUrl;
    const hasCredentialUpdate = draft.hasApiKeyChange;
    const needsConnectionUpdate = !draft.id || instanceUrlChanged || hasCredentialUpdate;

    if (needsConnectionUpdate && (!normalizedInstanceUrl || ((!draft.id || hasCredentialUpdate) && !apiKeyValid))) {
      setSaveErrorMessage(`Check the ${providerDefinition.instanceUrlLabel.toLowerCase()} and ${providerDefinition.apiKeyLabel.toLowerCase()} format.`);
      return;
    }

    try {
      let response: LmsIntegrationResponse;
      if (draft.id) {
        if (needsConnectionUpdate && hasCredentialUpdate) {
          await validateDraftMutation.mutateAsync({
            provider: draft.provider,
            config: { base_url: normalizedInstanceUrl! },
            credentials: { personal_access_token: normalizedApiKey },
          });
        } else if (!needsConnectionUpdate) {
          await validateSavedMutation.mutateAsync(draft.id);
        }

        response = await updateMutation.mutateAsync({
          integrationId: draft.id,
          payload: needsConnectionUpdate
            ? {
              display_name: draft.displayName.trim(),
              config: { base_url: normalizedInstanceUrl! },
              credentials: hasCredentialUpdate ? { personal_access_token: normalizedApiKey } : undefined,
            }
            : {
              display_name: draft.displayName.trim(),
            },
        });
      } else {
        await validateDraftMutation.mutateAsync({
          provider: draft.provider,
          config: { base_url: normalizedInstanceUrl! },
          credentials: { personal_access_token: normalizedApiKey },
        });

        response = await createMutation.mutateAsync({
          provider: draft.provider,
          display_name: draft.displayName.trim(),
          config: { base_url: normalizedInstanceUrl! },
          credentials: { personal_access_token: normalizedApiKey },
        });
      }

      setDraft({
        id: response.id,
        provider: response.provider as SupportedProvider,
        displayName: response.display_name,
        instanceUrl: getIntegrationInstanceUrl(response),
        apiKey: '',
        isEditingApiKey: false,
        hasApiKeyChange: false,
        maskedApiKey: response.masked_api_key ?? '',
      });
      setDialogOpen(false);
    } catch (error) {
      const failureMessage = resolveInlineApiErrorMessage(error, 'Failed to save LMS integration.');
      setSaveErrorMessage(failureMessage);
      void alert({
        title: 'Validation failed',
        description: failureMessage,
        confirmText: 'OK',
      });
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteIntegration) return;
    try {
      await deleteMutation.mutateAsync(pendingDeleteIntegration.id);
      if (draft.id === pendingDeleteIntegration.id) {
        setDraft(EMPTY_DRAFT);
        setDialogOpen(false);
      }
      setPendingDeleteIntegration(null);
    } catch (error) {
      void alert({
        title: 'Delete failed',
        description: resolveInlineApiErrorMessage(error, 'Failed to delete LMS integration.'),
        confirmText: 'OK',
      });
    }
  };

  return (
    <div className="w-full space-y-4">
      <CrudPanel
        title="LMS Integrations"
        description="Save reusable LMS connections for Program binding and Course linking."
        actionButton={(
          <Button type="button" className="shrink-0 self-start" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Integration
          </Button>
        )}
        items={integrationsQuery.data ?? []}
        isLoading={integrationsQuery.isLoading}
        emptyMessage="No LMS integrations yet."
        minWidthClassName="min-w-[560px]"
        renderHeader={() => (
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>LMS Provider</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        )}
        renderRow={(integration) => {
          const definition = getProviderDefinition(integration.provider);
          const isRevalidating = revalidatingIntegrationId === integration.id;
          const isConnected = integration.status === 'connected';
          return (
            <TableRow key={integration.id}>
              <TableCell>
                <span className="text-sm font-medium">{integration.display_name}</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background p-2">
                    <img src={definition.logoSrc} alt={definition.logoAlt} className="h-6 w-6 object-contain" />
                  </div>
                  <span className="text-sm font-medium">{definition.label}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Badge
                    variant={isRevalidating || !isConnected ? 'outline' : 'default'}
                    className={cn(
                      isConnected && !isRevalidating && 'bg-emerald-600 hover:bg-emerald-700',
                    )}
                  >
                    {isRevalidating ? 'Validating' : isConnected ? 'Connected' : integration.status}
                  </Badge>
                  {integration.last_error?.message ? (
                    <p className="max-w-[16rem] text-xs text-destructive">
                      {integration.last_error.message}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Edit ${integration.display_name}`}
                    title={`Edit ${integration.display_name}`}
                    onClick={() => openEditDialog(integration)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Revalidate ${integration.display_name}`}
                    title={`Revalidate ${integration.display_name}`}
                    disabled={validateSavedMutation.isPending || deleteMutation.isPending}
                    onClick={() => void handleValidateSaved(integration)}
                  >
                    <RefreshCw className={cn('size-4', isRevalidating && 'animate-spin')} />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${integration.display_name}`}
                    title={`Delete ${integration.display_name}`}
                    onClick={() => setPendingDeleteIntegration(integration)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        }}
      />
      <ResponsiveDialogDrawer
        open={dialogOpen}
        onOpenChange={closeDialog}
        title={draft.id ? 'Edit LMS Integration' : 'Add LMS Integration'}
        description={providerDefinition.description}
        desktopContentClassName="sm:max-w-2xl"
        showDesktopCloseButton={false}
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={isBusy} onClick={() => closeDialog(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={isBusy} onClick={() => void handleSave()}>
                {draft.id ? 'Save Changes' : 'Create Integration'}
              </Button>
          </div>
        )}
      >
        <div className="px-4 pb-4 sm:px-0 sm:pb-0">
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="lms-provider-type">LMS Type</FieldLabel>
                <Select
                  value={draft.provider}
                  disabled={Boolean(draft.id)}
                  onValueChange={(value) => {
                    setDraft((current) => ({ ...current, provider: value as SupportedProvider }));
                    setTouched(true);
                    resetFeedback();
                  }}
                >
                  <SelectTrigger id="lms-provider-type" className="w-full">
                    <SelectValue placeholder="Select LMS type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(LMS_PROVIDER_DEFINITIONS).map((definition) => (
                      <SelectItem key={definition.value} value={definition.value}>
                        {definition.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {draft.id ? 'Provider type cannot be changed after creation.' : 'Choose the LMS adapter for this integration.'}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="lms-display-name">Name</FieldLabel>
                <Input
                  id="lms-display-name"
                  value={draft.displayName}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, displayName: event.target.value }));
                    setTouched(true);
                    resetFeedback();
                  }}
                  placeholder="e.g. UofT Canvas"
                />
              </Field>

              <Field data-invalid={instanceUrlInvalid ? '' : undefined}>
                <FieldLabel htmlFor="lms-instance-url">{providerDefinition.instanceUrlLabel}</FieldLabel>
                <Input
                  id="lms-instance-url"
                  value={draft.instanceUrl}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, instanceUrl: event.target.value }));
                    setTouched(true);
                    resetFeedback();
                  }}
                  placeholder={providerDefinition.instanceUrlPlaceholder}
                  aria-invalid={instanceUrlInvalid}
                />
                <FieldDescription>
                  {draft.id
                    ? `Leave the saved ${providerDefinition.instanceUrlLabel.toLowerCase()} unchanged if you only want to rename this integration.`
                    : `Enter the ${providerDefinition.label} instance host for this connection.`}
                </FieldDescription>
              </Field>

              <Field data-invalid={apiKeyInvalid ? '' : undefined}>
                <FieldLabel htmlFor="lms-api-key">{providerDefinition.apiKeyLabel}</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    id="lms-api-key"
                    type={draft.id && !draft.isEditingApiKey ? 'text' : 'password'}
                    value={draft.id && !draft.isEditingApiKey ? displayedMaskedApiKey : draft.apiKey}
                    disabled={Boolean(draft.id) && !draft.isEditingApiKey}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(event) => {
                      setDraft((current) => ({
                        ...current,
                        apiKey: event.target.value,
                        hasApiKeyChange: true,
                      }));
                      setTouched(true);
                      resetFeedback();
                    }}
                    placeholder={providerDefinition.apiKeyPlaceholder}
                    aria-invalid={apiKeyInvalid}
                    className="flex-1"
                  />
                  {draft.id ? (
                    <Button
                      type="button"
                      variant={draft.isEditingApiKey ? 'default' : 'outline'}
                      className="h-9 w-9 shrink-0"
                      aria-label={draft.isEditingApiKey ? 'Save API key edit' : 'Edit API key'}
                      title={draft.isEditingApiKey ? 'Save API key edit' : 'Edit API key'}
                      onClick={() => {
                        if (draft.isEditingApiKey) {
                          setTouched(true);
                          if (draft.apiKey.trim() && !apiKeyValid) {
                            return;
                          }
                          setDraft((current) => ({ ...current, isEditingApiKey: false }));
                          resetFeedback();
                          return;
                        }

                        setDraft((current) => ({
                          ...current,
                          isEditingApiKey: true,
                          apiKey: current.hasApiKeyChange ? current.apiKey : '',
                        }));
                        resetFeedback();
                      }}
                    >
                      {draft.isEditingApiKey ? <Check className="size-4" /> : <Pencil className="size-4" />}
                    </Button>
                  ) : null}
                </div>
                <FieldDescription>
                  Saved API keys stay encrypted. Click the pencil to replace the key, then enter the full API key value.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>
          <div className="min-h-5 pt-3 text-left text-sm">
            {saveErrorMessage ? (
              <p className="truncate whitespace-nowrap text-destructive">
                {saveErrorMessage}
              </p>
            ) : null}
          </div>
        </div>
      </ResponsiveDialogDrawer>

      <AlertDialog open={Boolean(pendingDeleteIntegration)} onOpenChange={(open) => {
        if (!open && !deleteMutation.isPending) {
          setPendingDeleteIntegration(null);
        }
      }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete LMS integration</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteIntegration
                ? `Delete "${pendingDeleteIntegration.display_name}"? Programs or courses still using it must be unlinked first.`
                : 'Delete this LMS integration?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
