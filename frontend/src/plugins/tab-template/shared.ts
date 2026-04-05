export type TemplateSettings = {
  title?: string;
  note?: string;
  showChecklist?: boolean;
};

export const resolveTemplateSettings = (settings: Record<string, unknown>): Required<TemplateSettings> => ({
  title: typeof settings.title === 'string' ? settings.title : 'Tab Template',
  note: typeof settings.note === 'string' ? settings.note : '',
  showChecklist: typeof settings.showChecklist === 'boolean' ? settings.showChecklist : true,
});

