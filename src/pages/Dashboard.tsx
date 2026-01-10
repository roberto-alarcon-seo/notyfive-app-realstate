import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Users, MessageSquare, Clock, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { ExportReportButton } from "@/components/dashboard/ExportReportButton";
import { useRealEstateDashboard } from "@/hooks/useRealEstateDashboard";
import { subDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";

// Dashboard Components
import { KPICard } from "@/components/dashboard/KPICard";
import { CriticalAlertsCard } from "@/components/dashboard/CriticalAlertsCard";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { AIPerformanceCard } from "@/components/dashboard/AIPerformanceCard";
import { TopPropertiesCard } from "@/components/dashboard/TopPropertiesCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { ConversionFunnelChart } from "@/components/dashboard/ConversionFunnelChart";
import { LeadTemperatureChart } from "@/components/dashboard/LeadTemperatureChart";
import { ConversionTimeCard } from "@/components/dashboard/ConversionTimeCard";
import { PropertyStatusChart } from "@/components/dashboard/PropertyStatusChart";

export default function Dashboard() {
  const navigate = useNavigate();
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  
  const { data, isLoading } = useRealEstateDashboard(dateRange);

  const periodLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, "dd MMM", { locale: es })} - ${format(dateRange.to, "dd MMM yyyy", { locale: es })}`
    : "Últimos 30 días";

  return (
    <div className="h-full overflow-auto bg-background">
      <div ref={dashboardRef} className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Métricas inmobiliarias · {periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
            <ExportReportButton 
              dateRange={dateRange}
              dashboardRef={dashboardRef}
              analyticsData={{
                totalConversations: data?.pipelineTotal || 0,
                totalMessages: (data?.messaging.totalSent || 0) + (data?.messaging.totalReceived || 0),
                inboundMessages: data?.messaging.totalReceived || 0,
                outboundMessages: data?.messaging.totalSent || 0,
                responseRate: data?.messaging.responseRate || 0,
                avgResponseTime: "N/A",
                campaignsSent: 0,
                campaignDeliveryRate: 0,
                newContacts: data?.leadQuality.totalLeads || 0,
                totalContacts: data?.leadQuality.totalLeads || 0,
                walletBalance: data?.messaging.creditsRemaining || 0,
                walletSpent: data?.messaging.creditsUsedThisPeriod || 0,
                approvedTemplates: 0,
                pendingTemplates: 0,
                dailyMetrics: data?.dailyTrends.map(d => ({
                  date: d.date,
                  label: d.label,
                  conversations: d.newLeads,
                  messagesSent: d.messages,
                  responses: d.conversions,
                  delivered: d.messages,
                })) || [],
              }}
            />
            <Button variant="outline" size="sm" onClick={() => navigate("/pipeline")}>
              Ver Pipeline
            </Button>
            <Button size="sm" onClick={() => navigate("/campaigns/new")}>
              <Zap className="w-4 h-4 mr-2" />
              Nueva campaña
            </Button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total de Leads"
            value={data?.leadQuality.totalLeads || 0}
            icon={<Users className="w-5 h-5" />}
            loading={isLoading}
          />
          <KPICard
            title="Mensajes IA (periodo)"
            value={data?.messaging.aiResponses || 0}
            icon={<MessageSquare className="w-5 h-5" />}
            loading={isLoading}
          />
          <KPICard
            title="Seguimientos Pendientes"
            value={data?.followups.totalScheduled || 0}
            icon={<Clock className="w-5 h-5" />}
            loading={isLoading}
          />
          <KPICard
            title="Seguimientos Completados"
            value={data?.followups.completedThisPeriod || 0}
            icon={<CheckCircle className="w-5 h-5" />}
            loading={isLoading}
          />
        </div>

        {/* Critical Alerts */}
        <CriticalAlertsCard
          overdueFollowups={data?.followups.overdueCount || 0}
          ghostingLeads={data?.leadQuality.ghostingCount || 0}
          leadsWithoutProperty={data?.leadsWithoutProperty || 0}
          isLoading={isLoading}
        />

        {/* Conversion Funnel + Lead Temperature */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ConversionFunnelChart
            pipeline={data?.pipeline || []}
            pipelineTotal={data?.pipelineTotal || 0}
            isLoading={isLoading}
          />
          <LeadTemperatureChart
            hot={data?.leadQuality.temperatureBreakdown.hot || 0}
            warm={data?.leadQuality.temperatureBreakdown.warm || 0}
            cold={data?.leadQuality.temperatureBreakdown.cold || 0}
            total={data?.leadQuality.totalLeads || 0}
            isLoading={isLoading}
          />
        </div>

        {/* Conversion Time + Properties Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ConversionTimeCard
            avgDaysToConversion={data?.conversions.avgDaysToConversion || 0}
            totalConverted={data?.conversions.totalConverted || 0}
            conversionRate={data?.conversions.conversionRate || 0}
            convertedThisPeriod={data?.conversions.convertedThisPeriod || 0}
            isLoading={isLoading}
          />
          <PropertyStatusChart
            properties={data?.properties || {
              totalActive: 0,
              totalAvailable: 0,
              totalReserved: 0,
              totalSold: 0,
              avgPrice: 0,
              propertiesWithInterest: 0,
              topZones: [],
            }}
            isLoading={isLoading}
          />
        </div>

        {/* Activity Chart + AI Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActivityChart
            dailyTrends={data?.dailyTrends || []}
            isLoading={isLoading}
          />
          <AIPerformanceCard
            totalMessages={(data?.messaging.totalSent || 0) + (data?.messaging.totalReceived || 0)}
            aiMessages={data?.messaging.aiResponses || 0}
            humanMessages={data?.messaging.humanResponses || 0}
            responseRate={data?.messaging.responseRate || 0}
            isLoading={isLoading}
          />
        </div>

        {/* Top Properties + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopPropertiesCard
            properties={data?.topProperties || []}
            maxInterest={data?.maxPropertyInterest || 0}
            isLoading={isLoading}
          />
          <RecentActivityCard
            activities={data?.recentActivity || []}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
