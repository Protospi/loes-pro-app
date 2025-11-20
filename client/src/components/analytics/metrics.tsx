import { Users, MessagesSquare, Wrench, Brain, Smile } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  suffix?: string;
  color: string;
}

const MetricCard = ({ title, value, icon, suffix, color }: MetricCardProps) => (
  <Card className="p-4 glass-chip hover:bg-blue-500/5 transition-all duration-200">
    <div className="flex flex-col items-center text-center space-y-3">
      <div className="p-2 sm:p-3 rounded-lg" style={{ backgroundColor: `${color}10` }}>
        {icon}
      </div>
      <p className="hidden sm:block text-sm font-medium text-slate-600 dark:text-muted-foreground">
        {title}
      </p>
      <h3 className="text-xl font-bold text-foreground">
        {value.toLocaleString()}{suffix}
      </h3>
    </div>
  </Card>
);

interface MetricsProps {
  users: number;
  messages: number;
  functions: number;
  reasonings: number;
  csat: number;
}

export function Metrics({ users, messages, functions, reasonings, csat }: MetricsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-5 gap-4 col-span-5 h-full">
      <MetricCard
        title={t('analytics.metrics.users', 'Users')}
        value={users}
        color="#3b82f6"
        icon={<Users className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#3b82f6' }} />}
      />
      <MetricCard
        title={t('analytics.metrics.messages', 'Messages')}
        value={messages}
        color="#8b5cf6"
        icon={<MessagesSquare className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#8b5cf6' }} />}
      />
      <MetricCard
        title={t('analytics.metrics.tools', 'Tools')}
        value={functions}
        color="#10b981"
        icon={<Wrench className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#10b981' }} />}
      />
      <MetricCard
        title={t('analytics.metrics.reasonings', 'Reasonings')}
        value={reasonings}
        color="#f59e0b"
        icon={<Brain className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#f59e0b' }} />}
      />
      <MetricCard
        title={t('analytics.metrics.csat', 'CSAT')}
        value={csat}
        suffix="%"
        color="#ec4899"
        icon={<Smile className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#ec4899' }} />}
      />
    </div>
  );
}