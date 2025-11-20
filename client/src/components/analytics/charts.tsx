import { useEffect, useRef, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useTheme } from '@/components/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import * as d3 from 'd3';

interface DataPoint {
  date: Date;
  users: number;
  messages: number;
  functions: number;
  reasonings: number;
  csat: number;
}

interface TimeSeriesChartProps {
  data?: DataPoint[];
  timeGranularity?: 'hour' | 'day' | 'month';
  onTimeGranularityChange?: (granularity: 'hour' | 'day' | 'month') => void;
}

export function TimeSeriesChart({ 
  data: propData = [], 
  timeGranularity = 'day',
  onTimeGranularityChange 
}: TimeSeriesChartProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [visibleLines, setVisibleLines] = useState({
    users: true,
    messages: false,
    functions: false,
    reasonings: false,
    csat: false,
  });
  
  const data = propData;
  
  const metrics = {
    users: { color: '#3b82f6', label: t('analytics.users', 'Users') },
    messages: { color: '#8b5cf6', label: t('analytics.messages', 'Messages') },
    functions: { color: '#10b981', label: t('analytics.tools', 'Tools') },
    reasonings: { color: '#f59e0b', label: t('analytics.reasonings', 'Reasonings') },
    csat: { color: '#ec4899', label: t('analytics.csat', 'CSAT') },
  };

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 70, left: 60 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.date) as [Date, Date])
      .range([0, width]);

    const maxValue = d3.max(data, d => Math.max(
      visibleLines.users ? d.users : 0,
      visibleLines.messages ? d.messages : 0,
      visibleLines.functions ? d.functions : 0,
      visibleLines.reasonings ? d.reasonings : 0,
      visibleLines.csat ? d.csat : 0
    )) as number;

    const y = d3.scaleLinear()
      .domain([0, maxValue > 0 ? maxValue : 10])
      .range([height, 0])
      .nice();

    // Calculate optimal tick values for Y-axis
    // Ensure integer ticks with max 10 ticks and min interval of 1
    const calculateYTicks = () => {
      const domain = y.domain();
      const max = Math.ceil(domain[1]);
      
      if (max <= 10) {
        // If max is 10 or less, show every integer
        return Array.from({ length: max + 1 }, (_, i) => i);
      } else {
        // Calculate appropriate interval to get ~10 ticks or less
        const idealTickCount = 10;
        let interval = Math.ceil(max / idealTickCount);
        
        // Round interval to nice numbers (1, 2, 5, 10, 20, 25, 50, 100, etc.)
        const niceIntervals = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
        interval = niceIntervals.find(ni => ni >= interval) || interval;
        
        // Generate ticks from 0 to max with the calculated interval
        const ticks = [];
        for (let i = 0; i <= max; i += interval) {
          ticks.push(i);
        }
        // Ensure max value is included
        if (ticks[ticks.length - 1] < max) {
          ticks.push(Math.ceil(max / interval) * interval);
        }
        return ticks;
      }
    };

    const yTicks = calculateYTicks();

    // Add X axis with custom formatting
    const xAxis = d3.axisBottom(x);
    
    // Format based on granularity
    if (timeGranularity === 'hour') {
      xAxis.tickFormat((d) => {
        const date = d as Date;
        return date.getHours().toString();
      });
    } else if (timeGranularity === 'month') {
      xAxis.tickFormat((d) => {
        const date = d as Date;
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      });
    } else {
      xAxis.tickFormat((d) => {
        const date = d as Date;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
    }
    
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .attr('class', 'x-axis')
      .style('color', theme === 'dark' ? '#94a3b8' : '#64748b')
      .call(xAxis)
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    // Add X axis label for hour mode
    if (timeGranularity === 'hour') {
      svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom + 10)
        .style('fill', theme === 'dark' ? '#94a3b8' : '#64748b')
        .style('font-size', '12px')
        .text(t('analytics.hours', 'Hours (0-23)'));
    }

    // Add Y axis with custom integer ticks
    svg.append('g')
      .attr('class', 'y-axis')
      .style('color', theme === 'dark' ? '#94a3b8' : '#64748b')
      .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(d => d3.format('d')(d as number)));

    // Line generator
    const line = d3.line<DataPoint>()
      .x(d => x(d.date))
      .curve(d3.curveMonotoneX);

    // Helper function to format date for tooltip
    const formatDateForTooltip = (date: Date) => {
      if (timeGranularity === 'hour') {
        return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${date.getHours()}:00`;
      } else if (timeGranularity === 'month') {
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    };

    // Draw lines and data points for each visible metric
    Object.entries(metrics).forEach(([key, { color, label }]) => {
      if (!visibleLines[key as keyof typeof visibleLines]) return;

      // Draw the line
      svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('d', line.y(d => y(d[key as keyof DataPoint] as number)));

      // Add data points (circles) at each data point - always visible with hover interactions
      svg.selectAll(`.dot-${key}`)
        .data(data)
        .enter()
        .append('circle')
        .attr('class', `dot-${key}`)
        .attr('cx', d => x(d.date))
        .attr('cy', d => y(d[key as keyof DataPoint] as number))
        .attr('r', 4)
        .attr('fill', color)
        .attr('stroke', theme === 'dark' ? '#ffffff' : '#1e293b')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          // Enlarge the circle on hover
          d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr('r', 6);
          
          // Show tooltip
          if (tooltipRef.current) {
            tooltipRef.current.style.display = 'block';
            tooltipRef.current.style.left = `${x(d.date) + margin.left + 10}px`;
            tooltipRef.current.style.top = `${y(d[key as keyof DataPoint] as number) + margin.top - 10}px`;
            tooltipRef.current.innerHTML = `
              <div class="font-medium">${label}</div>
              <div class="text-lg font-bold">${d[key as keyof DataPoint]}${key === 'csat' ? '%' : ''}</div>
              <div class="text-sm text-muted-foreground">
                ${formatDateForTooltip(d.date)}
              </div>
            `;
          }
        })
        .on('mouseleave', (event) => {
          // Reset circle size
          d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr('r', 4);
          
          // Hide tooltip
          if (tooltipRef.current) {
            tooltipRef.current.style.display = 'none';
          }
        });

      // Add value labels above each data point - always visible
      svg.selectAll(`.label-${key}`)
        .data(data)
        .enter()
        .append('text')
        .attr('class', `label-${key}`)
        .attr('x', d => x(d.date))
        .attr('y', d => y(d[key as keyof DataPoint] as number) - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', color)
        .style('pointer-events', 'none')
        .text(d => `${d[key as keyof DataPoint]}${key === 'csat' ? '%' : ''}`);
    });

  }, [data, visibleLines, theme, timeGranularity, t]);

  const getVisibleCount = () => {
    return Object.values(visibleLines).filter(Boolean).length;
  };

  return (
    <Card className="p-4 glass-chip hover:bg-blue-500/5 transition-all duration-200">
      <div className="flex justify-between items-center mb-4">
        {/* Metrics Selector Dropdown - Left */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="glass-chip hover:bg-blue-500/20">
              {t('analytics.selectMetrics', 'Select Metrics')} ({getVisibleCount()})
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 glass-chip">
            <DropdownMenuLabel>{t('analytics.metrics', 'Metrics')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(metrics).map(([key, { color, label }]) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={visibleLines[key as keyof typeof visibleLines]}
                onCheckedChange={(checked) => 
                  setVisibleLines(prev => ({ ...prev, [key]: checked }))
                }
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </div>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Time Granularity Dropdown - Right */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="glass-chip hover:bg-blue-500/20">
              {t(`analytics.timeGranularity.${timeGranularity}`, timeGranularity.charAt(0).toUpperCase() + timeGranularity.slice(1))}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 glass-chip">
            <DropdownMenuLabel>{t('analytics.granularity', 'Granularity')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={timeGranularity} onValueChange={(value) => onTimeGranularityChange?.(value as 'hour' | 'day' | 'month')}>
              <DropdownMenuRadioItem value="hour">
                {t('analytics.timeGranularity.hour', 'Hour')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="day">
                {t('analytics.timeGranularity.day', 'Day')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="month">
                {t('analytics.timeGranularity.month', 'Month')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="relative">
        {data && data.length > 0 ? (
          <>
            <svg ref={svgRef} className="w-full" />
            <div
              ref={tooltipRef}
              className="absolute hidden p-3 bg-popover/95 backdrop-blur-sm text-popover-foreground rounded-lg shadow-xl pointer-events-none border border-blue-500/20 z-50"
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            <p>{t('analytics.noTimeSeriesData', 'No data available for the selected period')}</p>
          </div>
        )}
      </div>
    </Card>
  );
}