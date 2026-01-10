import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { ExportReportButton } from "@/components/dashboard/ExportReportButton";
import { useRealEstateDashboard } from "@/hooks/useRealEstateDashboard";
import { subDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";

// New Real Estate Dashboard Components
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { RealEstatePipelineFunnel } from "@/components/dashboard/RealEstatePipelineFunnel";
import { ConversionsCard } from "@/components/dashboard/ConversionsCard";
import { PropertiesOverviewCard } from "@/components/dashboard/PropertiesOverviewCard";
import { FollowupsCard } from "@/components/dashboard/FollowupsCard";
import { EventsCard } from "@/components/dashboard/EventsCard";
import { LeadQualityCard } from "@/components/dashboard/LeadQualityCard";
import { MessagingCard } from "@/components/dashboard/MessagingCard";
import { TrendsChart } from "@/components/dashboard/TrendsChart";

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
      <div ref={dashboardRef} className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-4">
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

        {/* Alerts */}
        {data?.alerts && (
          <AlertsPanel alerts={data.alerts} isLoading={isLoading} />
        )}

        {/* Main Grid - Pipeline Funnel + Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <RealEstatePipelineFunnel 
            pipeline={data?.pipeline || []}
            pipelineTotal={data?.pipelineTotal || 0}
            isLoading={isLoading}
          />
          <TrendsChart 
            dailyTrends={data?.dailyTrends || []}
            isLoading={isLoading}
          />
        </div>

        {/* Second Row - Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ConversionsCard 
            conversions={data?.conversions || { totalConverted: 0, convertedThisPeriod: 0, conversionRate: 0, avgDaysToConversion: 0, conversionsByStage: {} }}
            isLoading={isLoading}
          />
          <PropertiesOverviewCard 
            properties={data?.properties || { totalActive: 0, totalAvailable: 0, totalReserved: 0, totalSold: 0, avgPrice: 0, propertiesWithInterest: 0, topZones: [] }}
            isLoading={isLoading}
          />
          <FollowupsCard 
            followups={data?.followups || { totalScheduled: 0, overdueCount: 0, dueTodayCount: 0, dueTomorrowCount: 0, completedThisPeriod: 0, completionRate: 0 }}
            isLoading={isLoading}
          />
          <EventsCard 
            events={data?.events || { totalScheduled: 0, confirmedCount: 0, completedCount: 0, noShowCount: 0, canceledCount: 0, todayEvents: 0, upcomingEvents: 0, showRate: 0 }}
            isLoading={isLoading}
          />
        </div>

        {/* Third Row - Lead Quality & Messaging */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LeadQualityCard 
            leadQuality={data?.leadQuality || { totalLeads: 0, withCredit: 0, withBudget: 0, qualifiedCount: 0, ghostingCount: 0, activeCount: 0, avgBudget: 0, temperatureBreakdown: { hot: 0, warm: 0, cold: 0 } }}
            isLoading={isLoading}
          />
          <MessagingCard 
            messaging={data?.messaging || { totalSent: 0, totalReceived: 0, aiResponses: 0, humanResponses: 0, responseRate: 0, creditsRemaining: 0, creditsUsedThisPeriod: 0, estimatedDaysLeft: 999 }}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
