// input:  [route params/navigation primitives, shared layout/container/back button components, program entity context, LMS integration query, reusable Program settings form, plugin settings registry helpers, and Program plugin management panel]
// output: [`ProgramSettingsPage` route component]
// pos:    [Dedicated Program settings workspace route with breadcrumb-aware navigation, single-current-page breadcrumb semantics, query-backed Program/LMS data loading, Program-level plugin lifecycle management plus plugin settings sections, and page-based autosaving settings management]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getPluginIconById, PluginSettingsSectionRenderer, usePluginSettingsRegistry } from "@/plugin-system";
import { Layout } from "../components/Layout";
import { Container } from "../components/Container";
import { BackButton } from "../components/BackButton";
import { AppEmptyState } from "../components/AppEmptyState";
import { ProgramPluginManagementPanel } from "../components/ProgramPluginManagementPanel";
import { ProgramSettingsPanel } from "../components/ProgramSettingsPanel";
import { ProgramDataProvider, useProgramData } from "../contexts/ProgramDataContext";
import api from "../services/api";
import { queryKeys } from "@/services/queryKeys";
import { resolveCourseSubjectCode } from "@/utils/courseCategoryBadge";

const ProgramSettingsPageContent: React.FC = () => {
    const navigate = useNavigate();
    const { program, saveProgram, refreshProgram, isLoading } = useProgramData();
    const settingsFlushRef = useRef<(() => Promise<void>) | null>(null);

    const lmsIntegrationsQuery = useQuery({
        queryKey: queryKeys.user.lmsIntegrations(),
        queryFn: api.listLmsIntegrations,
        retry: false,
    });
    const programPluginInstallationsQuery = useQuery({
        queryKey: queryKeys.programs.pluginInstallations(program?.id ?? "__missing__"),
        queryFn: () => api.getProgramPluginInstallations(program!.id),
        enabled: Boolean(program?.id),
        staleTime: 30_000,
    });
    const allPluginSettingsDefinitions = usePluginSettingsRegistry("program");

    const discoveredSubjectCodes = useMemo(() => {
        if (!program) return [];
        return Array.from(new Set(
            program.semesters
                .flatMap((semester) => semester.courses || [])
                .map((course) => resolveCourseSubjectCode(course))
                .filter(Boolean),
        )).sort((left, right) => left.localeCompare(right));
    }, [program]);
    const programPluginSettingsSections = useMemo(() => {
        if (!program?.id) {
            return null;
        }

        const installations = programPluginInstallationsQuery.data ?? [];
        const installedPluginIds = new Set(
            installations
                .filter((installation) => installation.installed !== false)
                .map((installation) => installation.plugin_id),
        );
        const pluginSettingsDefinitions = allPluginSettingsDefinitions.filter((definition) => installedPluginIds.has(definition.pluginId));

        if (pluginSettingsDefinitions.length === 0) {
            return null;
        }

        const pluginMetadataById = new Map(
            installations.map((installation) => [
                installation.plugin_id,
                {
                    displayName: installation.display_name,
                    description: installation.description,
                    resolvedSettings: installation.resolved_program_settings,
                },
            ]),
        );
        const renderedPluginHeaders = new Set<string>();
        const sections = pluginSettingsDefinitions.map((definition) => {
            const pluginMetadata = pluginMetadataById.get(definition.pluginId);
            const showPluginHeader = !renderedPluginHeaders.has(definition.pluginId);
            renderedPluginHeaders.add(definition.pluginId);
            return (
                <React.Fragment key={`${definition.pluginId}:${definition.id}`}>
                    <PluginSettingsSectionRenderer
                        pluginId={definition.pluginId}
                        pluginIcon={getPluginIconById(definition.pluginId)}
                        pluginDisplayName={pluginMetadata?.displayName}
                        pluginDescription={pluginMetadata?.description}
                        showPluginHeader={showPluginHeader}
                        component={definition.component}
                        programId={program.id}
                        onRefresh={refreshProgram}
                    />
                </React.Fragment>
            );
        });

        return (
            <div className="flex flex-col gap-4">
                {sections}
            </div>
        );
    }, [allPluginSettingsDefinitions, program?.id, programPluginInstallationsQuery.data, refreshProgram]);

    const handleBack = async () => {
        await settingsFlushRef.current?.();
        navigate(program ? `/programs/${program.id}` : "/");
    };

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                        <Link to="/">Academics</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    {program ? (
                        <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                            <Link to={`/programs/${program.id}`}>{program.name}</Link>
                        </BreadcrumbLink>
                    ) : (
                        <span className="text-muted-foreground">Program</span>
                    )}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground font-semibold">Program Settings</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

    if (!isLoading && !program) {
        return (
            <Layout breadcrumb={breadcrumb}>
                <Container>
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Program not found"
                        description="The program you are looking for does not exist or has been deleted."
                        primaryAction={(
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        )}
                    />
                </Container>
            </Layout>
        );
    }

    return (
        <Layout breadcrumb={breadcrumb}>
            <Container className="space-y-8 py-8">
                <BackButton label="Back to Program" onClick={() => { void handleBack(); }} />

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Program Settings</h1>
                    <p className="text-muted-foreground">
                        Configure Program details, LMS defaults, plugin management, and course-code color mappings.
                    </p>
                </div>

                <Separator />

                {program ? (
                    <div className="space-y-8">
                        <ProgramSettingsPanel
                            initialName={program.name}
                            initialSettings={{
                                grad_requirement_credits: program.grad_requirement_credits,
                                gpa_scaling_table: program.gpa_scaling_table,
                                subject_color_map: program.subject_color_map,
                                hide_gpa: program.hide_gpa,
                                lms_integration_id: program.lms_integration_id ?? null,
                                has_lms_dependencies: program.has_lms_dependencies ?? false,
                            }}
                            lmsIntegrations={lmsIntegrationsQuery.data}
                            subjectCodes={discoveredSubjectCodes}
                            onSave={saveProgram}
                            registerFlush={(flush) => {
                                settingsFlushRef.current = flush;
                            }}
                        />
                        <ProgramPluginManagementPanel
                            programId={program.id}
                            onChanged={refreshProgram}
                        />
                        {programPluginSettingsSections}
                    </div>
                ) : null}
            </Container>
        </Layout>
    );
};

export const ProgramSettingsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    if (!id) {
        return (
            <Layout>
                <Container>
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Program not found"
                        description="No Program ID was provided in the route."
                        primaryAction={(
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        )}
                    />
                </Container>
            </Layout>
        );
    }

    return (
        <ProgramDataProvider programId={id}>
            <ProgramSettingsPageContent />
        </ProgramDataProvider>
    );
};
