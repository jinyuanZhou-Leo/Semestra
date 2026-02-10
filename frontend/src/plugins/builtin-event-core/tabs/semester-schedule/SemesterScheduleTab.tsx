import React from 'react';
import { CalendarDays, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import scheduleService from '@/services/schedule';
import { EmptyTableRow, PanelHeader } from '../../components/CrudPanel';
import { WeeklyCalendarView } from '../../components/WeeklyCalendarView';
import { ALL_FILTER_VALUE, DEFAULT_WEEK } from '../../shared/constants';
import { useEventBus } from '../../shared/eventBus';
import { useScheduleData } from '../../shared/hooks/useScheduleData';
import {
  buildCourseOptions,
  buildTypeOptions,
  filterScheduleItems,
  getDayLabel,
} from '../../shared/utils';

export const SemesterScheduleTab: React.FC<{ semesterId: string }> = ({ semesterId }) => {
  const [week, setWeek] = React.useState(DEFAULT_WEEK);
  const [showSkipped, setShowSkipped] = React.useState(true);
  const [courseFilter, setCourseFilter] = React.useState(ALL_FILTER_VALUE);
  const [typeFilter, setTypeFilter] = React.useState(ALL_FILTER_VALUE);

  const {
    itemsByWeek,
    maxWeek,
    isLoading,
    isRefreshing,
    error,
    reload,
  } = useScheduleData({
    semesterId,
    mode: 'all-weeks',
    withConflicts: true,
    enabled: Boolean(semesterId),
  });

  React.useEffect(() => {
    setWeek((currentWeek) => {
      if (currentWeek > maxWeek) return maxWeek;
      if (currentWeek < DEFAULT_WEEK) return DEFAULT_WEEK;
      return currentWeek;
    });
  }, [maxWeek]);

  React.useEffect(() => {
    if (!error) return;
    toast.error(error.message || 'Failed to load semester schedule.');
  }, [error]);

  useEventBus('timetable:schedule-data-changed', (payload) => {
    if (payload.source !== 'course' && payload.source !== 'semester') return;
    void reload();
  }, [reload]);

  const selectedWeekItems = React.useMemo(() => {
    return itemsByWeek.get(week) ?? [];
  }, [itemsByWeek, week]);

  const filteredItems = React.useMemo(() => {
    return filterScheduleItems(selectedWeekItems, {
      showSkipped,
      courseFilter,
      typeFilter,
    });
  }, [courseFilter, selectedWeekItems, showSkipped, typeFilter]);

  const courseOptions = React.useMemo(() => buildCourseOptions(selectedWeekItems), [selectedWeekItems]);
  const typeOptions = React.useMemo(() => buildTypeOptions(selectedWeekItems), [selectedWeekItems]);

  const handleWeekChange = React.useCallback((nextWeekRaw: string) => {
    const parsed = Number(nextWeekRaw || DEFAULT_WEEK);
    if (!Number.isFinite(parsed)) {
      setWeek(DEFAULT_WEEK);
      return;
    }

    const normalizedWeek = Math.max(DEFAULT_WEEK, Math.min(maxWeek, Math.floor(parsed)));
    setWeek(normalizedWeek);
  }, [maxWeek]);

  const handleExport = React.useCallback(async (format: 'png' | 'pdf' | 'ics') => {
    try {
      const payload = {
        scope: 'semester' as const,
        scopeId: semesterId,
        range: 'week' as const,
        week,
        skipRenderMode: 'GRAY_SKIPPED' as const,
      };

      const result = await scheduleService.exportSchedule(format, payload);

      if (format === 'ics') {
        const blob = result as Blob;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `semester-${semesterId}-week-${week}.ics`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? `Failed to export ${format}.`);
    }
  }, [semesterId, week]);

  return (
    <div className="space-y-4 select-none">
      <div>
        <PanelHeader
          title="Semester Schedule"
          description="Filter by course and type, inspect conflicts, and export weekly schedule."
          right={(
            <Button variant="outline" size="sm" onClick={() => void reload()} disabled={isLoading || isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline">{filteredItems.length} Visible Events</Badge>
          <Badge variant="outline">Week {week}/{maxWeek}</Badge>
        </div>
      </div>

      <div className="space-y-4 py-6 pt-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filters & Export</CardTitle>
            <CardDescription>Apply filters before exporting the current week.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="semester-week">Week</Label>
                <Input
                  id="semester-week"
                  type="number"
                  min={1}
                  max={maxWeek}
                  value={week}
                  onChange={(event) => handleWeekChange(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>All Courses</SelectItem>
                    {courseOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>All Types</SelectItem>
                    {typeOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display</Label>
                <div className="flex h-9 items-center space-x-2 rounded-md border px-3">
                  <Switch
                    id="semester-show-skipped"
                    checked={showSkipped}
                    onCheckedChange={(checked) => setShowSkipped(checked)}
                  />
                  <Label htmlFor="semester-show-skipped" className="cursor-pointer text-sm font-normal text-muted-foreground">
                    Show skipped
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Export</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleExport('png')}>
                    <Download className="mr-2 h-4 w-4" />
                    PNG
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleExport('pdf')}>
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleExport('ics')}>
                    <Download className="mr-2 h-4 w-4" />
                    ICS
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Week {week} / {maxWeek}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Semester Weekly Calendar</CardTitle>
            <CardDescription>Visual week layout by day and time.</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyCalendarView
              items={filteredItems}
              emptyMessage={isLoading ? 'Loading schedule...' : 'No events matched the current filter.'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Semester Weekly Schedule List</CardTitle>
            <CardDescription>Conflict groups are highlighted in red.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conflict</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 && (
                  <EmptyTableRow
                    colSpan={5}
                    message={isLoading ? 'Loading schedule...' : 'No events matched the current filter.'}
                  />
                )}
                {filteredItems.map((item) => (
                  <TableRow key={`${item.eventId}-${item.week}`}>
                    <TableCell className="font-medium">{item.courseName}</TableCell>
                    <TableCell>{item.eventTypeCode}</TableCell>
                    <TableCell>{getDayLabel(item.dayOfWeek)} {item.startTime}-{item.endTime}</TableCell>
                    <TableCell>
                      {item.skip ? <Badge variant="secondary">Skipped</Badge> : <Badge>Active</Badge>}
                    </TableCell>
                    <TableCell>
                      {item.isConflict
                        ? <Badge variant="destructive">{item.conflictGroupId}</Badge>
                        : <Badge variant="outline">None</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
