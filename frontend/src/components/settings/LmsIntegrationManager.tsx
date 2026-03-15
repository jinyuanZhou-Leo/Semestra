// input:  [TanStack Query, LMS API service, settings-local LMS provider definitions, CRUD panel/table helpers, responsive dialog wrapper, shadcn field/dialog primitives, alert-dialog primitives, and dialog-context alerts]
// output: [`LmsIntegrationManager` component]
// pos:    [settings-specific LMS integration management surface that delegates provider-specific payload shaping to local provider definitions while preserving CRUD-table, validation, and dialog flows]
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
import { cn } from '@/lib/utils';
import {
  getDefaultLmsProvider,
  getLmsProviderDefinition,
  getSupportedLmsProviderDefinitions,
  type SupportedLmsProvider,
} from './lmsProviderDefinitions';

interface DraftState {
  id: string | null;
  provider: SupportedLmsProvider;
  displayName: string;
  instanceUrl: string;
  apiKey: string;
  isEditingApiKey: boolean;
  hasApiKeyChange: boolean;
  maskedApiKey: string;
}

const EMPTY_DRAFT: DraftState = {
  id: null,
  provider: getDefaultLmsProvider(),
  displayName: '',
  instanceUrl: '',
  apiKey: '',
  isEditingApiKey: false,
  hasApiKeyChange: false,
  maskedApiKey: '',
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
    () => getLmsProviderDefinition(draft.provider),
    [draft.provider],
  );
  const selectedIntegration = useMemo(
    () => integrationsQuery.data?.find((item) => item.id === draft.id) ?? null,
    [draft.id, integrationsQuery.data],
  );
  if (providerDefinition === null) {
    throw new Error(`Unsupported LMS provider in draft: ${draft.provider}`);
  }

  const selectedProviderDefinition = selectedIntegration
    ? getLmsProviderDefinition(selectedIntegration.provider)
    : null;
  const selectedInstanceUrl = selectedIntegration && selectedProviderDefinition
    ? selectedProviderDefinition.getInstanceUrl(selectedIntegration)
    : '';
  const normalizedApiKey = draft.apiKey.trim();
  const normalizedInstanceUrl = providerDefinition.normalizeInstanceUrl(draft.instanceUrl.trim());
  const displayNameValid = draft.displayName.trim().length > 0;
  const apiKeyValid = providerDefinition.validateCredential(normalizedApiKey);
  const displayedMaskedApiKey = draft.hasApiKeyChange
    ? providerDefinition.maskCredential(normalizedApiKey)
    : draft.maskedApiKey;
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
    const definition = getLmsProviderDefinition(integration.provider);
    if (definition === null) {
      void alert({
        title: 'Unsupported provider',
        description: `${integration.provider} is not supported by this settings UI.`,
        confirmText: 'OK',
      });
      return;
    }

    setDraft({
      id: integration.id,
      provider: definition.value,
      displayName: integration.display_name,
      instanceUrl: definition.getInstanceUrl(integration),
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
      const configPayload = normalizedInstanceUrl ? providerDefinition.buildConfig(normalizedInstanceUrl) : null;
      const credentialPayload = providerDefinition.buildCredentials(normalizedApiKey);
      if (draft.id) {
        if (needsConnectionUpdate && hasCredentialUpdate) {
          await validateDraftMutation.mutateAsync({
            provider: draft.provider,
            config: configPayload!,
            credentials: credentialPayload,
          });
        }

        response = await updateMutation.mutateAsync({
          integrationId: draft.id,
          payload: needsConnectionUpdate
            ? {
              display_name: draft.displayName.trim(),
              config: configPayload!,
              credentials: hasCredentialUpdate ? credentialPayload : undefined,
            }
            : {
              display_name: draft.displayName.trim(),
            },
        });
      } else {
        await validateDraftMutation.mutateAsync({
          provider: draft.provider,
          config: configPayload!,
          credentials: credentialPayload,
        });

        response = await createMutation.mutateAsync({
          provider: draft.provider,
          display_name: draft.displayName.trim(),
          config: configPayload!,
          credentials: credentialPayload,
        });
      }

      setDraft({
        id: response.id,
        provider: providerDefinition.value,
        displayName: response.display_name,
        instanceUrl: providerDefinition.getInstanceUrl(response),
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
          const definition = getLmsProviderDefinition(integration.provider);
          const isRevalidating = revalidatingIntegrationId === integration.id;
          const isConnected = integration.status === 'connected';
          return (
            <TableRow key={integration.id}>
              <TableCell>
                <span className="text-sm font-medium">{integration.display_name}</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  {definition ? (
                    <>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background p-2">
                        <img src={definition.logoSrc} alt={definition.logoAlt} className="h-6 w-6 object-contain" />
                      </div>
                      <span className="text-sm font-medium">{definition.label}</span>
                    </>
                  ) : (
                    <span className="text-sm font-medium">{integration.provider}</span>
                  )}
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
                    disabled={!definition}
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
                    setDraft((current) => ({ ...current, provider: value as SupportedLmsProvider }));
                    setTouched(true);
                    resetFeedback();
                  }}
                >
                  <SelectTrigger id="lms-provider-type" className="w-full">
                    <SelectValue placeholder="Select LMS type" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSupportedLmsProviderDefinitions().map((definition) => (
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
