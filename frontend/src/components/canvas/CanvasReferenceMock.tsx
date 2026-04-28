import type { LucideIcon } from 'lucide-react';
import { ExternalLink, Home, Info, Newspaper, NotebookPen, PanelLeft, Bell, Search, Clock3, Paperclip} from 'lucide-react';

import { cn } from '@/lib/utils';

const COURSE_LINKS = ['Home', 'Lectures', 'Labs', 'Tutorials', 'Plenary Lectures', 'Past Exams', 'Piazza', 'AskAlan'];

const LEGACY_ANNOUNCEMENTS = [
  {
    author: 'AC',
    preview: 'Course note: the posted recap slides and practice set are now available in Modules.',
    postedAt: 'Apr 4, 2026, 2:01 p.m.',
    title: 'Week 8 review set and recap slides posted',
  },
  {
    author: 'ML',
    preview: 'The lecture recording has been uploaded together with a short index of solved examples.',
    postedAt: 'Apr 2, 2026, 10:37 p.m.',
    title: 'Lecture recording uploaded',
  },
  {
    author: 'AC',
    preview: 'Office hours this week have moved to Friday afternoon. Please check the updated calendar entry.',
    postedAt: 'Mar 27, 2026, 10:29 a.m.',
    title: 'Office hour change for this week',
  },
];

const LEGACY_MODULE_FILES = [
  '(Please read) ECE110 lecture schedule.pdf',
  '(Please read) ECE110 course information and policies.pdf',
  '(Please read) ECE110 syllabus.pdf',
  'Reference notes and worksheet pack.pdf',
];

const COURSE_MENU_ITEMS: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Home, label: 'Home' },
  { icon: Bell, label: 'Announcements' },
  { icon: NotebookPen, label: 'Grades' },
  { icon: Info, label: 'Syllabus' },
  { icon: Newspaper, label: 'Pages' },
];

interface CanvasReferenceCourseContentProps {
  compact?: boolean;
  className?: string;
}

const CanvasReferenceCourseContent = ({
  compact = false,
  className,
}: CanvasReferenceCourseContentProps) => (
  <div className={cn('flex min-w-0 flex-col gap-6 text-[#f3f4f6]', compact ? 'gap-5' : 'gap-7', className)}>
    <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-5">
      <div className="min-w-0">
        <h2 className="text-[1.9rem] font-semibold tracking-tight text-white">Home</h2>
        <p className="mt-1 text-sm text-white/50">A course surface for schedules, syllabus, and weekly materials.</p>
      </div>
      <a
        href="https://canvas.example.edu/courses/ece110"
        target="_blank"
        rel="noreferrer"
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm font-medium text-white/88 transition-colors hover:bg-white/10"
      >
        <ExternalLink className="size-3.5" />
        Open in Canvas
      </a>
    </div>

    <div className="flex flex-wrap items-center gap-x-2 gap-y-3 text-[1.05rem] font-semibold text-white">
      {COURSE_LINKS.map((link, index) => (
        <div key={link} className="flex items-center gap-2">
          <span className={cn(link === 'Home' ? 'underline underline-offset-4' : 'text-white/88')}>{link}</span>
          {index < COURSE_LINKS.length - 1 ? <span className="text-white/30">|</span> : null}
        </div>
      ))}
      <span className="text-white/70">(CourseID: ece110-01)</span>
    </div>

    <div className="max-w-[56rem] space-y-4 text-[1.02rem] leading-8 text-white/78">
      <h3 className="text-[1.55rem] font-semibold tracking-tight text-white">Course Syllabus and Course Schedule</h3>
      <p>
        <span className="mr-2 rounded-md border border-white/10 bg-white/7 px-2 py-1 font-mono text-sm text-white whitespace-nowrap">Welcome</span>
        This course page brings lecture materials, schedule context, and teaching contacts into one readable panel so
        students can quickly scan the essentials for the week.
      </p>
    </div>
  </div>
);

interface CanvasIntegratedMockShellProps {
  className?: string;
  compact?: boolean;
  showTopChrome?: boolean;
  showCourseMenu?: boolean;
}

export const CanvasIntegratedMockShell = ({
  className,
  compact = false,
  showTopChrome = false,
  showCourseMenu = true,
}: CanvasIntegratedMockShellProps) => (
  <div
    className={cn(
      'overflow-hidden rounded-[2rem] border border-white/10 bg-[#09090b] text-white shadow-[0_40px_120px_-48px_rgba(0,0,0,0.95)]',
      className,
    )}
  >
    {showTopChrome ? (
      <>
        <div className="flex items-center justify-between gap-4 border-b border-white/6 px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="text-2xl font-semibold tracking-tight text-white">Semestra</div>
            <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 md:flex">
              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs">ECE</span>
              <span>Winter</span>
              <span className="text-white/30">›</span>
              <span>26F</span>
              <span className="text-white/30">›</span>
              <span className="text-white">ECE110</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/60">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <Search className="size-3.5" />
              <span className="hidden sm:inline">/</span>
            </div>
            <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
              <Clock3 className="size-4" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-white/6 px-5 py-3">
          <div className="flex items-center gap-3 text-[2rem] font-semibold tracking-tight text-white">
            <span className="text-white/70">26F</span>
            <span className="text-white/30">›</span>
            <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1 text-[2rem]">ECE110</span>
          </div>
          <div className="hidden rounded-2xl border border-white/8 bg-white/[0.03] p-1 lg:flex">
            {['Dashboard', 'Canvas', 'Gradebook', 'Todo', 'Course Schedule', 'Course Resource'].map((tab) => (
              <div
                key={tab}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-medium text-white/55',
                  tab === 'Canvas' ? 'bg-white/[0.08] text-white' : '',
                )}
              >
                {tab}
              </div>
            ))}
          </div>
        </div>
      </>
    ) : null}

    <div className={cn('grid min-w-0 gap-5 p-5', showCourseMenu ? 'lg:grid-cols-[10.5rem_minmax(0,1fr)]' : '')}>
      {showCourseMenu ? (
        <aside className="rounded-[1.5rem] border border-white/8 bg-white/[0.02] p-3">
          <div className="px-1 pb-3">
            <p className="text-sm font-semibold text-white">Course menu</p>
            <p className="text-xs text-white/45">Canvas course menu</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {COURSE_MENU_ITEMS.map(({ icon: ItemIcon, label }, index) => (
                <div
                  key={label}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium',
                    index === 0 ? 'bg-white/[0.09] text-white' : 'text-white/66',
                  )}
                >
                  <span className={cn(
                    'flex size-7 items-center justify-center rounded-lg',
                    index === 0 ? 'bg-white/10' : 'bg-white/[0.05]',
                  )}>
                    <ItemIcon className="size-3.5" />
                  </span>
                  <span>{label}</span>
                </div>
            ))}
          </div>
        </aside>
      ) : null}

      <section className="min-w-0 rounded-[1.75rem] border border-white/8 bg-[#0b0b0d] p-5">
        <CanvasReferenceCourseContent compact={compact} />
      </section>
    </div>
  </div>
);

interface CanvasLegacyMockPanelProps {
  className?: string;
}

export const CanvasLegacyMockPanel = ({ className }: CanvasLegacyMockPanelProps) => (
  <div className={cn('overflow-hidden rounded-[1.25rem] border border-[#cfd8e3] bg-[#eef2f7] shadow-[0_18px_50px_-28px_rgba(15,23,42,0.55)]', className)}>
    <div className="grid min-h-0 grid-cols-[4.5rem_minmax(0,1fr)]">
      <aside className="flex flex-col items-center gap-5 bg-[#0f3b79] px-3 py-4 text-white">
        <div className="flex size-12 items-center justify-center rounded-md border border-white/20 bg-white/12 text-xl font-semibold">U</div>
        {['Account', 'Dashboard', 'Courses', 'Groups', 'Calendar', 'Inbox'].map((item, index) => (
          <div key={item} className={cn('text-center text-[0.72rem] leading-tight text-white/82', index === 2 ? 'font-semibold text-white' : '')}>
            {item}
          </div>
        ))}
      </aside>

      <div className="min-w-0 bg-white px-6 py-5 font-serif text-[#4b5563]">
        <div className="mb-6 flex items-center gap-3 border-b border-[#e5e7eb] pb-4 text-sm text-[#3b82f6]">
          <PanelLeft className="size-4" />
          <span>ECE110H1 S LEC0101</span>
          <span className="text-[#9ca3af]">›</span>
          <span className="text-[#4b5563]">Modules</span>
        </div>

        <div className="space-y-7">
          <div>
            <h3 className="text-[2rem] font-medium tracking-tight text-[#374151]">Recent Announcements</h3>
          </div>
          <div className="space-y-3">
            <div className="space-y-0">
              {LEGACY_ANNOUNCEMENTS.map((announcement, index) => (
                <div key={announcement.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)_9.5rem] items-start gap-3 border-b border-[#eceff3] py-4">
                  <div className="flex items-center justify-center pt-1">
                    {index === 2 ? <div className="size-3 rounded-full bg-[#1f4b8f]" /> : (
                      <div className="flex size-8 items-center justify-center rounded-full border border-[#d4d8df] bg-[#f3f4f6] text-[0.65rem] font-semibold text-[#374151]">
                        {announcement.author}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 font-sans">
                    <p className="truncate text-[0.92rem] font-semibold text-[#374151]">{announcement.title}</p>
                    <p className="mt-1 truncate text-[0.85rem] text-[#4b5563]">{announcement.preview}</p>
                  </div>
                  <div className="pt-1 text-right font-sans text-[0.8rem] text-[#6b7280]">
                    <p className="font-semibold">Posted on:</p>
                    <p>{announcement.postedAt}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <div className="rounded-sm border border-[#d8dde6] bg-[#f3f4f6] px-4 py-2 font-sans text-sm text-[#4b5563]">Collapse All</div>
            </div>
          </div>
          <div className="overflow-hidden border border-[#dfe3e8] bg-[#f7f7f7]">
            <div className="border-b border-[#dfe3e8] bg-[#f1f3f5] px-4 py-3 font-sans text-[0.95rem] font-semibold text-[#4b5563]">
              Course Information (MUST READ)
            </div>
            <div className="bg-white">
              {LEGACY_MODULE_FILES.slice(0, 2).map((file) => (
                <div key={file} className="flex items-center gap-3 border-b border-[#eceff3] px-4 py-4 font-sans text-[0.92rem] text-[#374151] last:border-b-0">
                  <Paperclip className="size-4 shrink-0 text-[#6b7280]" />
                  <span className="truncate">{file}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
