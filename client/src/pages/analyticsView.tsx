import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar as CalendarIcon, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsDropdown } from "@/components/chat/settings-dropdown";
import { Metrics } from "@/components/analytics/metrics";
import { TimeSeriesChart } from "@/components/analytics/charts";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";

interface AnalyticsData {
  users: number;
  messages: number;
  meetings: number;
  cost: number;
  csat: number;
  conversations: number;
  timeSeries: Array<{
    date: Date;
    users: number;
    messages: number;
    meetings: number;
    cost: number;
    csat: number;
  }>;
}

export default function AnalyticsView() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
  // Initialize date range: from start of current month to today
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // Active date range used for queries
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: startOfMonth,
    to: today,
  });
  
  // Track the first selected date when starting a new range selection
  const [firstSelectedDate, setFirstSelectedDate] = useState<Date | null>(null);
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [timeGranularity, setTimeGranularity] = useState<'hour' | 'day' | 'month'>('day');

  // Fetch analytics data
  const { data: analyticsData, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['analytics', dateRange.from?.toISOString(), dateRange.to?.toISOString(), timeGranularity],
    queryFn: async () => {
      if (!dateRange.from || !dateRange.to) {
        throw new Error('Date range is required');
      }
      
      const response = await fetch(
        `/api/analytics/summary?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}&granularity=${timeGranularity}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      
      // Convert date strings to Date objects
      return {
        ...data,
        timeSeries: data.timeSeries.map((item: any) => ({
          ...item,
          date: new Date(item.date)
        }))
      };
    },
    enabled: !!dateRange.from && !!dateRange.to,
  });

  return (
    <div className="h-screen flex flex-col bg-gradient-dark relative">
      {/* Header Row with Date Range Picker, Title, and Settings Dropdown */}
      <header className="relative grid grid-cols-3 items-center p-4 z-10">
        {/* Date Range Picker - Left */}
        <div className="flex justify-start">
          <Popover 
            open={isCalendarOpen} 
            onOpenChange={(open) => {
              setIsCalendarOpen(open);
              // Reset selection state if calendar is closed
              if (!open) {
                setFirstSelectedDate(null);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size={isMobile ? "icon" : "default"}
                className="glass-chip hover:bg-blue-500/20 transition-all duration-200 group px-3 gap-2"
                data-testid="button-date-range-picker"
                title={t('analytics.selectDateRange', 'Select Date Range')}
              >
                <CalendarIcon className="h-5 w-5 text-slate-600 dark:text-muted-foreground group-hover:text-blue-400 group-hover:scale-110 transition-all" />
                {!isMobile && (
                  <span className="text-sm text-slate-600 dark:text-muted-foreground group-hover:text-blue-400 transition-all">
                    {dateRange.from && dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                      </>
                    ) : (
                      t('analytics.selectDates', 'Select dates')
                    )}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-0 glass-chip border-blue-500/20 shadow-xl backdrop-blur-xl" 
            align="start"
          >
            <Calendar
              mode="range"
              selected={firstSelectedDate ? { from: firstSelectedDate, to: undefined } : dateRange}
              onSelect={(_, selectedDay) => {
                if (!selectedDay) return;
                
                if (!firstSelectedDate) {
                  // First click: Start new selection from this specific date
                  // We use selectedDay directly to avoid any range merging logic from the library
                  setFirstSelectedDate(selectedDay);
                  setDateRange({
                    from: selectedDay,
                    to: undefined,
                  });
                } else {
                  // Second click: Complete the range
                  const from = firstSelectedDate < selectedDay ? firstSelectedDate : selectedDay;
                  const to = firstSelectedDate < selectedDay ? selectedDay : firstSelectedDate;
                  
                  setDateRange({
                    from,
                    to,
                  });
                  setFirstSelectedDate(null);
                  setIsCalendarOpen(false);
                }
              }}
              numberOfMonths={1}
              initialFocus
              disabled={(date) => date > today}
              defaultMonth={startOfMonth}
              className="rounded-lg"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium text-foreground",
                nav: "space-x-1 flex items-center",
                nav_button: "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-blue-500/20 transition-all rounded-md border border-blue-500/20",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-range-start)]:rounded-l-md [&:has([aria-selected])]:bg-blue-500/10 focus-within:relative focus-within:z-20 transition-all duration-200",
                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-blue-500/20 rounded-md transition-all duration-200",
                day_range_end: "!bg-blue-500 !text-white hover:!bg-blue-600 font-semibold shadow-lg",
                day_range_start: "!bg-blue-500 !text-white hover:!bg-blue-600 font-semibold shadow-lg",
                day_selected: "bg-blue-500 text-white hover:bg-blue-600 focus:bg-blue-600 shadow-md",
                day_today: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-blue-400",
                day_outside: "day-outside text-muted-foreground/50 aria-selected:bg-blue-500/5 aria-selected:text-muted-foreground/50",
                day_disabled: "text-muted-foreground/30 opacity-50",
                day_range_middle: "aria-selected:bg-blue-500/20 aria-selected:text-foreground rounded-none",
                day_hidden: "invisible",
              }}
            />
          </PopoverContent>
          </Popover>
        </div>

        {/* Title - Center (Always centered regardless of side element sizes) */}
        <div className="flex justify-center">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            {!isMobile && (
              <span>{t('analytics.title', 'Analytics View')}</span>
            )}
          </h1>
        </div>

        {/* Settings Dropdown - Right */}
        <div className="flex justify-end">
          <SettingsDropdown />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full relative overflow-hidden p-6">
        {/* Analytics Dashboard */}
        <div className="w-[85%] mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-500">
              <p>{t('analytics.error', 'Failed to load analytics data')}</p>
            </div>
          ) : analyticsData ? (
            <>
              {/* Metrics Row */}
              <div className="grid grid-cols-1 gap-4">
                <Metrics
                  users={analyticsData.users}
                  messages={analyticsData.messages}
                  meetings={analyticsData.meetings}
                  cost={analyticsData.cost}
                  csat={analyticsData.csat}
                />
              </div>
              
              {/* Time Series Chart */}
              <div className="mt-6">
                <TimeSeriesChart 
                  data={analyticsData.timeSeries}
                  timeGranularity={timeGranularity}
                  onTimeGranularityChange={setTimeGranularity}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>{t('analytics.noData', 'No data available for the selected date range')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
