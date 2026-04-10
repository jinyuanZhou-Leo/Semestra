import React from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { PluginSetupReviewRenderer } from "../../components/PluginSetupRenderers";
import type { PluginSystemSemesterSetupPlugin, SemesterPluginActivation } from "../../services/api";
import type { PluginSetupDraftMap } from "./types";
import { getPluginReviewValues, getReviewErrorStepLabel } from "./utils";

interface ReviewError {
  step: string;
  code: string;
  plugin_id?: string | null;
  message: string;
  field_path?: string | null;
}

interface WizardReviewStepProps {
  semesterName: string;
  reviewDateRange: string;
  reviewReadingWeek: string;
  courseReviewMeta: string;
  courseReviewSummary: string;
  pluginReviewMeta: string;
  pluginReviewSummary: string;
  reviewSummaryPlugins: PluginSystemSemesterSetupPlugin[];
  pluginSetupDrafts: PluginSetupDraftMap;
  reviewErrors: ReviewError[];
  blockedEnabledPlugins: SemesterPluginActivation[];
  pluginDisplayNameById: Map<string, string>;
  semesterId: string | undefined;
  programId: string | undefined;
}

export const WizardReviewStep: React.FC<WizardReviewStepProps> = ({
  semesterName,
  reviewDateRange,
  reviewReadingWeek,
  courseReviewMeta,
  courseReviewSummary,
  pluginReviewMeta,
  pluginReviewSummary,
  reviewSummaryPlugins,
  pluginSetupDrafts,
  reviewErrors,
  blockedEnabledPlugins,
  pluginDisplayNameById,
  semesterId,
  programId,
}) => (
  <div className="space-y-6">
    <section className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-muted-foreground">Semester</div>
        <div className="text-2xl leading-tight font-semibold tracking-tight text-foreground sm:text-3xl">
          {semesterName || "Untitled Semester"}
        </div>
      </div>

      <dl className="grid gap-y-3 border-t border-border/70 pt-4">
        {[
          { label: "Date range", value: reviewDateRange },
          { label: "Reading week", value: reviewReadingWeek },
          { label: "Courses", value: courseReviewMeta, detail: courseReviewSummary },
          { label: "Plugins", value: pluginReviewMeta, detail: pluginReviewSummary },
        ].map((item) => (
          <div key={item.label} className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-4">
            <dt className="text-sm font-medium text-muted-foreground">{item.label}</dt>
            <div className="min-w-0">
              <dd className="text-sm leading-6 font-medium text-foreground">
                {item.value}
              </dd>
              {item.detail ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.detail}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </dl>
    </section>

    {reviewSummaryPlugins.length > 0 ? (
      <div className="space-y-4">
        <div className="text-sm font-medium">Plugin setup summary</div>
        <Accordion type="single" collapsible className="rounded-xl border border-border/70 px-4">
          {reviewSummaryPlugins.map((plugin) => (
            <AccordionItem key={`review:${plugin.plugin_id}`} value={`review:${plugin.plugin_id}`}>
              <AccordionTrigger className="gap-4 py-5 hover:no-underline">
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{plugin.display_name}</div>
                  <div className="text-sm text-muted-foreground">{plugin.description}</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-1">
                <PluginSetupReviewRenderer
                  plugin={plugin}
                  values={getPluginReviewValues(plugin, pluginSetupDrafts[plugin.plugin_id])}
                  semesterId={semesterId}
                  programId={programId}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    ) : null}

    {reviewErrors.length > 0 ? (
      <div className="space-y-3">
        {reviewErrors.map((error) => (
          <Card
            key={`${error.step}:${error.code}:${error.plugin_id ?? "platform"}:${error.field_path ?? "detail"}`}
            size="sm"
            className="border-amber-500/30 shadow-none"
          >
            <CardContent className="space-y-2">
              <div className="font-medium text-foreground">
                {getReviewErrorStepLabel(error.step)}
                {error.plugin_id ? ` · ${pluginDisplayNameById.get(error.plugin_id) ?? error.plugin_id}` : ""}
              </div>
              <div className="text-sm text-muted-foreground">{error.message}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    ) : null}

    {blockedEnabledPlugins.length > 0 ? (
      <div className="space-y-3">
        {blockedEnabledPlugins.map((plugin) => (
          <Card key={`blocked:${plugin.plugin_id}`} size="sm" className="border-amber-500/30 shadow-none">
            <CardContent className="space-y-2">
              <div className="font-medium text-foreground">Plugins · {plugin.display_name}</div>
              <div className="text-sm text-muted-foreground">{plugin.availability_reason ?? "This enabled plugin is still blocked."}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    ) : null}
  </div>
);
