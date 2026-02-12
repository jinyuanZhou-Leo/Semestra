export type TemplateSettings = {
  title?: string;
  note?: string;
  showChecklist?: boolean;
};

export const resolveTemplateSettings = (settings: TemplateSettings | undefined): Required<TemplateSettings> => ({
  title: settings?.title ?? 'Tab Template',
  note: settings?.note ?? '',
  showChecklist: settings?.showChecklist ?? true,
});

