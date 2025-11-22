import { Users, MessagesSquare, Smile, CalendarCheck, DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  title: string | React.ReactNode;
  value: number;
  icon: React.ReactNode;
  suffix?: string;
  color: string;
  isSelected?: boolean;
  onClick?: () => void;
}

const MetricCard = ({ title, value, icon, suffix, color, isSelected = false, onClick }: MetricCardProps) => (
  <Card 
    className={`p-4 glass-chip hover:bg-blue-500/10 transition-all duration-200 cursor-pointer ${
      isSelected 
        ? 'ring-2 ring-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' 
        : 'opacity-50 hover:opacity-70'
    }`}
    onClick={onClick}
  >
    <div className="flex flex-col items-center text-center space-y-3">
      <div className="p-2 sm:p-3 rounded-lg" style={{ backgroundColor: `${color}10` }}>
        {icon}
      </div>
      <p className="hidden sm:block text-sm font-medium text-slate-600 dark:text-muted-foreground">
        {title}
      </p>
      <h3 className="text-lg font-bold text-foreground">
        {value.toLocaleString()}{suffix}
      </h3>
    </div>
  </Card>
);

interface MetricsProps {
  users: number;
  messages: number;
  meetings: number;
  cost: number;
  csat: number;
  selectedMetrics?: {
    users: boolean;
    messages: boolean;
    meetings: boolean;
    cost: boolean;
    csat: boolean;
  };
  onMetricToggle?: (metric: 'users' | 'messages' | 'meetings' | 'cost' | 'csat') => void;
}

export function Metrics({ users, messages, meetings, cost, csat, selectedMetrics, onMetricToggle }: MetricsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-5 gap-4 col-span-5 h-full">
      <MetricCard
        title={t('analytics.metrics.users', 'Users')}
        value={users}
        color="#3b82f6"
        icon={<Users className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#3b82f6' }} />}
        isSelected={selectedMetrics?.users}
        onClick={() => onMetricToggle?.('users')}
      />
      <MetricCard
        title={t('analytics.metrics.messages', 'Messages')}
        value={messages}
        color="#8b5cf6"
        icon={<MessagesSquare className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#8b5cf6' }} />}
        isSelected={selectedMetrics?.messages}
        onClick={() => onMetricToggle?.('messages')}
      />
      <MetricCard
        title={t('analytics.metrics.meetings', 'Meetings')}
        value={meetings}
        color="#f59e0b"
        icon={<CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#f59e0b' }} />}
        isSelected={selectedMetrics?.meetings}
        onClick={() => onMetricToggle?.('meetings')}
      />
      <MetricCard
        title={
          <>
            {t('analytics.metrics.csat', 'CSAT')} <span className="text-xs">(%)</span>
          </>
        }
        value={csat}
        suffix=""
        color="#ec4899"
        icon={<Smile className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#ec4899' }} />}
        isSelected={selectedMetrics?.csat}
        onClick={() => onMetricToggle?.('csat')}
      />
      <MetricCard
        title={t('analytics.metrics.cost', 'Cost')}
        value={parseFloat(cost.toFixed(2))}
        suffix=""
        color="#10b981"
        icon={<DollarSign className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#10b981' }} />}
        isSelected={selectedMetrics?.cost}
        onClick={() => onMetricToggle?.('cost')}
      />
    </div>
  );
}