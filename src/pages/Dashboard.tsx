import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  Send, 
  Users, 
  Inbox,
  FileText,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  Zap,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MetricCard, QuickStat } from "@/components/dashboard/MetricCard";
import { ConversationsChart, DeliveryFunnel, AIvsHumanChart } from "@/components/dashboard/AnalyticsCharts";
import { SmartAlerts } from "@/components/dashboard/SmartAlerts";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { ExportReportButton } from "@/components/dashboard/ExportReportButton";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import { cn } from "@/lib/utils";
import { subDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";

export default function Dashboard() {
  const navigate = useNavigate();
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  // Date range state - default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  
  const { data: analytics, isLoading } = useDashboardAnalytics(dateRange);

  // Format period label for display
  const periodLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, "dd MMM", { locale: es })} - ${format(dateRange.to, "dd MMM yyyy", { locale: es })}`
    : "Últimos 30 días";

  return (
    <div className="h-full overflow-auto bg-background">
      <div ref={dashboardRef} className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Métricas en tiempo real · {periodLabel}
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
                totalConversations: analytics?.conversationsGenerated || 0,
                totalMessages: (analytics?.totalMessagesSent || 0) + (analytics?.totalResponses || 0),
                inboundMessages: analytics?.totalResponses || 0,
                outboundMessages: analytics?.totalMessagesSent || 0,
                responseRate: analytics?.responseRate || 0,
                avgResponseTime: "N/A",
                campaignsSent: analytics?.completedCampaigns || 0,
                campaignDeliveryRate: analytics?.totalMessagesSent 
                  ? ((analytics?.totalMessagesDelivered || 0) / analytics.totalMessagesSent * 100) 
                  : 0,
                newContacts: analytics?.newContactsThisMonth || 0,
                totalContacts: analytics?.totalContacts || 0,
                walletBalance: analytics?.creditsRemaining || 0,
                walletSpent: analytics?.creditsUsedThisMonth || 0,
                approvedTemplates: analytics?.approvedTemplates || 0,
                pendingTemplates: analytics?.pendingTemplates || 0,
                dailyMetrics: analytics?.dailyMetrics || [],
              }}
            />
            <Button variant="outline" size="sm" onClick={() => navigate("/campaigns")}>
              Ver campañas
            </Button>
            <Button size="sm" onClick={() => navigate("/campaigns/new")}>
              <Zap className="w-4 h-4 mr-2" />
              Nueva campaña
            </Button>
          </div>
        </div>

        {/* Alerts Section */}
        <SmartAlerts />

        {/* Main KPIs Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricCard
            title="Conversaciones"
            value={analytics?.conversationsGenerated || 0}
            currentValue={analytics?.conversationsGenerated}
            previousValue={analytics?.conversationsPreviousMonth}
            icon={<MessageSquare className="w-4 h-4" />}
            iconBg="bg-primary/10 text-primary"
            loading={isLoading}
            tooltip="Conversaciones iniciadas en el período seleccionado"
          />
          <MetricCard
            title="Tasa respuesta"
            value={`${analytics?.responseRate || 0}%`}
            currentValue={analytics?.responseRate}
            previousValue={analytics?.responseRatePreviousMonth}
            icon={<TrendingUp className="w-4 h-4" />}
            iconBg={cn(
              (analytics?.responseRate || 0) >= 15 ? "bg-emerald-500/10 text-emerald-500" :
              (analytics?.responseRate || 0) >= 8 ? "bg-amber-500/10 text-amber-500" :
              "bg-destructive/10 text-destructive"
            )}
            loading={isLoading}
            tooltip="Porcentaje de mensajes que reciben respuesta"
          />
          <MetricCard
            title="Mensajes enviados"
            value={analytics?.totalMessagesSent.toLocaleString() || 0}
            icon={<Send className="w-4 h-4" />}
            iconBg="bg-blue-500/10 text-blue-500"
            loading={isLoading}
            tooltip="Total de mensajes enviados en el período"
          />
          <MetricCard
            title="Respuestas"
            value={analytics?.totalResponses.toLocaleString() || 0}
            icon={<Inbox className="w-4 h-4" />}
            iconBg="bg-emerald-500/10 text-emerald-500"
            loading={isLoading}
            tooltip="Mensajes recibidos de tus contactos"
          />
          <MetricCard
            title="Créditos"
            value={analytics?.creditsRemaining.toLocaleString() || 0}
            subtitle={analytics?.estimatedDaysLeft && analytics.estimatedDaysLeft < 999 
              ? `~${analytics.estimatedDaysLeft} días restantes` 
              : undefined}
            icon={<Wallet className="w-4 h-4" />}
            iconBg={cn(
              (analytics?.estimatedDaysLeft || 0) > 30 ? "bg-emerald-500/10 text-emerald-500" :
              (analytics?.estimatedDaysLeft || 0) > 7 ? "bg-amber-500/10 text-amber-500" :
              "bg-destructive/10 text-destructive"
            )}
            loading={isLoading}
            tooltip="Balance actual de créditos"
          />
          <MetricCard
            title="Opt-outs"
            value={analytics?.totalOptOuts || 0}
            subtitle={`${analytics?.optOutRate || 0}% tasa`}
            icon={<AlertTriangle className="w-4 h-4" />}
            iconBg={cn(
              (analytics?.optOutRate || 0) > 3 ? "bg-destructive/10 text-destructive" :
              (analytics?.optOutRate || 0) > 1 ? "bg-amber-500/10 text-amber-500" :
              "bg-muted text-muted-foreground"
            )}
            loading={isLoading}
            tooltip="Contactos que se dieron de baja"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ConversationsChart 
            dailyMetrics={analytics?.dailyMetrics || []} 
            isLoading={isLoading}
          />
          <DeliveryFunnel
            sent={analytics?.totalMessagesSent || 0}
            delivered={analytics?.totalMessagesDelivered || 0}
            responses={analytics?.totalResponses || 0}
            isLoading={isLoading}
          />
        </div>

        {/* Bottom Row - 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Campaigns Overview */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Campañas</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/campaigns")}>
                  Ver <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <QuickStat label="Activas" value={analytics?.activeCampaigns || 0} color="success" />
              <QuickStat label="Completadas" value={analytics?.completedCampaigns || 0} />
              <QuickStat label="Borradores" value={analytics?.draftCampaigns || 0} />
              <div className="pt-2 border-t mt-2">
                {analytics?.topCampaignName ? (
                  <div className="text-xs">
                    <p className="text-muted-foreground">Mejor campaña:</p>
                    <p className="font-medium truncate">{analytics.topCampaignName}</p>
                    <Badge variant="outline" className="mt-1 text-emerald-500 border-emerald-500/30">
                      {analytics.topCampaignResponseRate}% respuesta
                    </Badge>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin campañas con datos</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contacts Overview */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Contactos</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/contacts")}>
                  Ver <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <QuickStat label="Total" value={analytics?.totalContacts.toLocaleString() || 0} />
              <QuickStat label="Activos" value={analytics?.activeContacts.toLocaleString() || 0} color="success" />
              <QuickStat 
                label="Nuevos en período" 
                value={`+${analytics?.newContactsThisMonth || 0}`}
                color={analytics?.newContactsThisMonth && analytics.newContactsThisMonth > 0 ? "success" : "default"}
              />
              <div className="pt-2 border-t mt-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {analytics?.activeContacts || 0} contactos alcanzables
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Templates Overview */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Plantillas</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/templates")}>
                  Ver <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <QuickStat 
                label="Aprobadas" 
                value={analytics?.approvedTemplates || 0} 
                color="success" 
              />
              <QuickStat 
                label="Pendientes" 
                value={analytics?.pendingTemplates || 0}
                color={analytics?.pendingTemplates && analytics.pendingTemplates > 0 ? "warning" : "default"}
              />
              <QuickStat 
                label="Rechazadas" 
                value={analytics?.rejectedTemplates || 0}
                color={analytics?.rejectedTemplates && analytics.rejectedTemplates > 0 ? "danger" : "default"}
              />
              <div className="pt-2 border-t mt-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {(analytics?.approvedTemplates || 0) + (analytics?.pendingTemplates || 0) + (analytics?.rejectedTemplates || 0)} plantillas total
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI vs Human */}
          <AIvsHumanChart
            aiCount={analytics?.aiResponsesCount || 0}
            humanCount={analytics?.humanResponsesCount || 0}
            isLoading={isLoading}
          />
        </div>

        {/* Inbox Quick Stats */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Resumen del Inbox</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/inbox")}>
                Ir al inbox <ArrowUpRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className={cn(
                  "p-2 rounded-lg",
                  (analytics?.openConversations || 0) > 0 ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
                )}>
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{analytics?.openConversations || 0}</p>
                  <p className="text-xs text-muted-foreground">Conversaciones abiertas</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className={cn(
                  "p-2 rounded-lg",
                  (analytics?.unreadMessages || 0) > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                )}>
                  <Inbox className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{analytics?.unreadMessages || 0}</p>
                  <p className="text-xs text-muted-foreground">Mensajes sin leer</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{analytics?.aiResponsesCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Respuestas IA en período</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{analytics?.humanResponsesCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Respuestas humanas</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
