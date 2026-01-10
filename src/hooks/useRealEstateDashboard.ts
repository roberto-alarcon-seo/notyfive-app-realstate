import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  subDays, 
  startOfDay, 
  endOfDay, 
  differenceInDays,
  format,
  eachDayOfInterval,
  isToday,
  isTomorrow,
  isPast,
  startOfMonth,
} from "date-fns";

// Pipeline stages in order
export const PIPELINE_STAGES = [
  { key: 'new_lead', label: 'Nuevo Lead', color: 'hsl(var(--chart-1))' },
  { key: 'interest_confirmed', label: 'Interés Confirmado', color: 'hsl(var(--chart-2))' },
  { key: 'financial_validation', label: 'Validación Financiera', color: 'hsl(var(--chart-3))' },
  { key: 'searching', label: 'Búsqueda Activa', color: 'hsl(var(--chart-4))' },
  { key: 'visit_done', label: 'Visita Realizada', color: 'hsl(var(--chart-5))' },
  { key: 'follow_up', label: 'Seguimiento', color: 'hsl(var(--amber-500))' },
  { key: 'negotiation', label: 'Negociación', color: 'hsl(var(--primary))' },
  { key: 'closed_won', label: 'Ganado', color: 'hsl(var(--emerald-500))' },
  { key: 'closed_lost', label: 'Perdido', color: 'hsl(var(--destructive))' },
];

export interface PipelineMetric {
  stage: string;
  label: string;
  count: number;
  color: string;
  percentage: number;
}

export interface ConversionMetric {
  totalConverted: number;
  convertedThisPeriod: number;
  conversionRate: number;
  avgDaysToConversion: number;
  conversionsByStage: Record<string, number>;
}

export interface PropertyMetric {
  totalActive: number;
  totalAvailable: number;
  totalReserved: number;
  totalSold: number;
  avgPrice: number;
  propertiesWithInterest: number;
  topZones: { zone: string; count: number }[];
}

export interface FollowupMetric {
  totalScheduled: number;
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  completedThisPeriod: number;
  completionRate: number;
}

export interface EventMetric {
  totalScheduled: number;
  confirmedCount: number;
  completedCount: number;
  noShowCount: number;
  canceledCount: number;
  todayEvents: number;
  upcomingEvents: number;
  showRate: number;
}

export interface LeadQualityMetric {
  totalLeads: number;
  withCredit: number;
  withBudget: number;
  qualifiedCount: number;
  ghostingCount: number;
  activeCount: number;
  avgBudget: number;
  temperatureBreakdown: {
    hot: number;
    warm: number;
    cold: number;
  };
}

export interface DailyTrendMetric {
  date: string;
  label: string;
  newLeads: number;
  conversions: number;
  visits: number;
  messages: number;
}

export interface PropertyInterest {
  id: string;
  title: string;
  zone: string;
  interestedCount: number;
}

export interface RecentActivity {
  id: string;
  type: 'ai_message' | 'new_lead' | 'followup' | 'visit' | 'conversion';
  description: string;
  timestamp: string;
  contactName?: string;
}

export interface RealEstateDashboardData {
  // Pipeline metrics
  pipeline: PipelineMetric[];
  pipelineTotal: number;
  
  // Conversion metrics
  conversions: ConversionMetric;
  
  // Property metrics
  properties: PropertyMetric;
  
  // Followup metrics
  followups: FollowupMetric;
  
  // Event/Visit metrics
  events: EventMetric;
  
  // Lead quality metrics
  leadQuality: LeadQualityMetric;
  
  // Messaging & Credits
  messaging: {
    totalSent: number;
    totalReceived: number;
    aiResponses: number;
    humanResponses: number;
    responseRate: number;
    creditsRemaining: number;
    creditsUsedThisPeriod: number;
    estimatedDaysLeft: number;
  };
  
  // Daily trends for charts
  dailyTrends: DailyTrendMetric[];
  
  // Top properties by interest
  topProperties: PropertyInterest[];
  maxPropertyInterest: number;
  
  // Recent activity
  recentActivity: RecentActivity[];
  
  // Leads without property
  leadsWithoutProperty: number;
  
  // Quick stats
  alerts: {
    overdueFollowups: number;
    lowCredits: boolean;
    pendingVisits: number;
    unreadMessages: number;
    ghostingLeads: number;
  };
  
  // Period info
  periodDays: number;
  periodStart: Date;
  periodEnd: Date;
}

interface DateRangeInput {
  from?: Date;
  to?: Date;
}

export function useRealEstateDashboard(dateRange?: DateRangeInput) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const now = new Date();
  const startDate = dateRange?.from || subDays(now, 30);
  const endDate = dateRange?.to || now;
  const days = differenceInDays(endDate, startDate) || 30;

  return useQuery({
    queryKey: ["real-estate-dashboard", tenantId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<RealEstateDashboardData> => {
      if (!tenantId) throw new Error("No tenant ID");

      const currentMonthStart = startOfMonth(now);

      // Parallel queries for maximum efficiency
      const [
        contactsResult,
        propertiesResult,
        followupsResult,
        eventsResult,
        messagesResult,
        walletResult,
        walletTransactionsResult,
        conversationsResult,
        conversionLogsResult,
      ] = await Promise.all([
        // All contacts with RE fields
        supabase
          .from("contacts")
          .select(`
            id, 
            name,
            pipeline_stage, 
            operational_status, 
            lead_temperature,
            lead_score,
            re_credit_preapproved,
            re_budget_estimated_mxn,
            re_monthly_income_mxn,
            re_property_interest_id,
            internal_converted_at,
            internal_converted_stage,
            internal_conversion_count,
            created_at,
            status
          `)
          .eq("tenant_id", tenantId),
        
        // Properties
        supabase
          .from("properties")
          .select("id, title, status, zone, price, is_active")
          .eq("tenant_id", tenantId),
        
        // Followups
        supabase
          .from("conversation_followups")
          .select("id, status, due_at, completed_at, created_at")
          .eq("tenant_id", tenantId),
        
        // Events (visits, calls, etc)
        supabase
          .from("events")
          .select("id, event_type, status, start_at, created_at")
          .eq("tenant_id", tenantId),
        
        // Messages in period
        supabase
          .from("messages")
          .select("id, direction, ai_generated, source, status, created_at, contact_id")
          .eq("tenant_id", tenantId)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
        
        // Wallet balance
        supabase
          .from("wallets")
          .select("balance_messages")
          .eq("tenant_id", tenantId)
          .single(),
        
        // Wallet transactions this month
        supabase
          .from("wallet_transactions")
          .select("messages, type, created_at")
          .eq("tenant_id", tenantId)
          .eq("type", "debit")
          .gte("created_at", currentMonthStart.toISOString()),
        
        // Open conversations with unread
        supabase
          .from("conversations")
          .select("id, unread_count, status")
          .eq("tenant_id", tenantId)
          .eq("status", "open"),
        
        // Conversion logs
        supabase
          .from("conversion_event_logs")
          .select("id, source, pipeline_stage, created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", startDate.toISOString()),
      ]);

      const contacts = contactsResult.data || [];
      const properties = propertiesResult.data || [];
      const followups = followupsResult.data || [];
      const events = eventsResult.data || [];
      const messages = messagesResult.data || [];
      const wallet = walletResult.data;
      const walletTransactions = walletTransactionsResult.data || [];
      const conversations = conversationsResult.data || [];
      const conversionLogs = conversionLogsResult.data || [];

      // === PIPELINE METRICS ===
      const pipelineCounts = PIPELINE_STAGES.map(stage => {
        const count = contacts.filter(c => c.pipeline_stage === stage.key).length;
        return {
          stage: stage.key,
          label: stage.label,
          count,
          color: stage.color,
          percentage: 0,
        };
      });
      
      const pipelineTotal = pipelineCounts.reduce((sum, p) => sum + p.count, 0);
      pipelineCounts.forEach(p => {
        p.percentage = pipelineTotal > 0 ? (p.count / pipelineTotal) * 100 : 0;
      });

      // === CONVERSION METRICS ===
      const convertedContacts = contacts.filter(c => c.internal_converted_at);
      const convertedThisPeriod = convertedContacts.filter(c => 
        new Date(c.internal_converted_at!) >= startDate && 
        new Date(c.internal_converted_at!) <= endDate
      ).length;
      
      const conversionsByStage: Record<string, number> = {};
      convertedContacts.forEach(c => {
        const stage = c.internal_converted_stage || 'unknown';
        conversionsByStage[stage] = (conversionsByStage[stage] || 0) + 1;
      });

      const avgDaysToConversion = convertedContacts.length > 0
        ? convertedContacts.reduce((sum, c) => {
            const created = new Date(c.created_at);
            const converted = new Date(c.internal_converted_at!);
            return sum + differenceInDays(converted, created);
          }, 0) / convertedContacts.length
        : 0;

      // === PROPERTY METRICS ===
      const activeProperties = properties.filter(p => p.is_active);
      const availableProperties = properties.filter(p => p.status === 'available' && p.is_active);
      const reservedProperties = properties.filter(p => p.status === 'reserved');
      const soldProperties = properties.filter(p => p.status === 'sold');
      
      const propertiesWithInterest = new Set(
        contacts.filter(c => c.re_property_interest_id).map(c => c.re_property_interest_id)
      ).size;

      const zoneCounts: Record<string, number> = {};
      properties.forEach(p => {
        if (p.zone) {
          zoneCounts[p.zone] = (zoneCounts[p.zone] || 0) + 1;
        }
      });
      const topZones = Object.entries(zoneCounts)
        .map(([zone, count]) => ({ zone, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const avgPrice = activeProperties.length > 0
        ? activeProperties.reduce((sum, p) => sum + (p.price || 0), 0) / activeProperties.length
        : 0;

      // === FOLLOWUP METRICS ===
      const scheduledFollowups = followups.filter(f => f.status === 'scheduled');
      const nowDate = new Date();
      
      const overdueFollowups = scheduledFollowups.filter(f => 
        isPast(new Date(f.due_at)) && !isToday(new Date(f.due_at))
      );
      const dueTodayFollowups = scheduledFollowups.filter(f => isToday(new Date(f.due_at)));
      const dueTomorrowFollowups = scheduledFollowups.filter(f => isTomorrow(new Date(f.due_at)));
      
      const completedFollowupsThisPeriod = followups.filter(f => 
        f.status === 'completed' &&
        f.completed_at &&
        new Date(f.completed_at) >= startDate &&
        new Date(f.completed_at) <= endDate
      );
      
      const totalFollowupsCreatedThisPeriod = followups.filter(f =>
        new Date(f.created_at) >= startDate && new Date(f.created_at) <= endDate
      ).length;

      const followupCompletionRate = totalFollowupsCreatedThisPeriod > 0
        ? (completedFollowupsThisPeriod.length / totalFollowupsCreatedThisPeriod) * 100
        : 0;

      // === EVENT METRICS ===
      const scheduledEvents = events.filter(e => e.status === 'scheduled');
      const confirmedEvents = events.filter(e => e.status === 'confirmed');
      const completedEvents = events.filter(e => e.status === 'completed');
      const noShowEvents = events.filter(e => e.status === 'no_show');
      const canceledEvents = events.filter(e => e.status === 'canceled');
      
      const todayEvents = events.filter(e => 
        isToday(new Date(e.start_at)) && 
        ['scheduled', 'confirmed'].includes(e.status)
      );
      
      const upcomingEvents = events.filter(e => 
        new Date(e.start_at) > nowDate && 
        ['scheduled', 'confirmed'].includes(e.status)
      );

      const totalEventsThatHappened = completedEvents.length + noShowEvents.length;
      const showRate = totalEventsThatHappened > 0
        ? (completedEvents.length / totalEventsThatHappened) * 100
        : 0;

      // === LEAD QUALITY METRICS ===
      const activeLeads = contacts.filter(c => c.status === 'active');
      const leadsWithCredit = contacts.filter(c => c.re_credit_preapproved);
      const leadsWithBudget = contacts.filter(c => c.re_budget_estimated_mxn && c.re_budget_estimated_mxn > 0);
      const qualifiedLeads = contacts.filter(c => 
        c.re_credit_preapproved || (c.re_budget_estimated_mxn && c.re_budget_estimated_mxn > 0)
      );
      const ghostingLeads = contacts.filter(c => c.operational_status === 'GHOSTING');

      const budgets = leadsWithBudget.map(c => c.re_budget_estimated_mxn!);
      const avgBudget = budgets.length > 0 
        ? budgets.reduce((sum, b) => sum + b, 0) / budgets.length 
        : 0;

      const hotLeads = contacts.filter(c => c.lead_temperature === 'hot').length;
      const warmLeads = contacts.filter(c => c.lead_temperature === 'warm').length;
      const coldLeads = contacts.filter(c => c.lead_temperature === 'cold').length;

      // === MESSAGING METRICS ===
      const outboundMessages = messages.filter(m => m.direction === 'outbound');
      const inboundMessages = messages.filter(m => m.direction === 'inbound');
      const aiResponses = outboundMessages.filter(m => m.ai_generated);
      const humanResponses = outboundMessages.filter(m => !m.ai_generated && m.source === 'manual');
      const deliveredMessages = outboundMessages.filter(m => ['delivered', 'read'].includes(m.status));
      
      const responseRate = deliveredMessages.length > 0
        ? (inboundMessages.length / deliveredMessages.length) * 100
        : 0;

      const creditsUsedThisPeriod = walletTransactions.reduce((sum, t) => sum + t.messages, 0);
      const avgDailyUsage = creditsUsedThisPeriod / Math.max(days, 1);
      const estimatedDaysLeft = avgDailyUsage > 0
        ? Math.floor((wallet?.balance_messages || 0) / avgDailyUsage)
        : 999;

      // === DAILY TRENDS ===
      const dateRange_interval = eachDayOfInterval({ start: startDate, end: endDate });
      
      const dailyTrends: DailyTrendMetric[] = dateRange_interval.map(date => {
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        
        const newLeadsDay = contacts.filter(c => {
          const created = new Date(c.created_at);
          return created >= dayStart && created <= dayEnd;
        }).length;
        
        const conversionsDay = conversionLogs.filter(l => {
          const created = new Date(l.created_at);
          return created >= dayStart && created <= dayEnd && l.source === 'INTERNAL';
        }).length;
        
        const visitsDay = events.filter(e => {
          const eventDate = new Date(e.start_at);
          return eventDate >= dayStart && eventDate <= dayEnd && 
                 e.event_type === 'visit' && e.status === 'completed';
        }).length;
        
        const messagesDay = messages.filter(m => {
          const created = new Date(m.created_at);
          return created >= dayStart && created <= dayEnd && m.direction === 'outbound';
        }).length;

        return {
          date: format(date, "yyyy-MM-dd"),
          label: format(date, "dd MMM"),
          newLeads: newLeadsDay,
          conversions: conversionsDay,
          visits: visitsDay,
          messages: messagesDay,
        };
      });

      // === ALERTS ===
      const unreadMessages = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      const lowCredits = (wallet?.balance_messages || 0) < 100 || estimatedDaysLeft < 7;

      return {
        pipeline: pipelineCounts,
        pipelineTotal,
        
        conversions: {
          totalConverted: convertedContacts.length,
          convertedThisPeriod,
          conversionRate: pipelineTotal > 0 ? (convertedContacts.length / pipelineTotal) * 100 : 0,
          avgDaysToConversion: Math.round(avgDaysToConversion),
          conversionsByStage,
        },
        
        properties: {
          totalActive: activeProperties.length,
          totalAvailable: availableProperties.length,
          totalReserved: reservedProperties.length,
          totalSold: soldProperties.length,
          avgPrice: Math.round(avgPrice),
          propertiesWithInterest,
          topZones,
        },
        
        followups: {
          totalScheduled: scheduledFollowups.length,
          overdueCount: overdueFollowups.length,
          dueTodayCount: dueTodayFollowups.length,
          dueTomorrowCount: dueTomorrowFollowups.length,
          completedThisPeriod: completedFollowupsThisPeriod.length,
          completionRate: Math.round(followupCompletionRate),
        },
        
        events: {
          totalScheduled: scheduledEvents.length,
          confirmedCount: confirmedEvents.length,
          completedCount: completedEvents.length,
          noShowCount: noShowEvents.length,
          canceledCount: canceledEvents.length,
          todayEvents: todayEvents.length,
          upcomingEvents: upcomingEvents.length,
          showRate: Math.round(showRate),
        },
        
        leadQuality: {
          totalLeads: contacts.length,
          withCredit: leadsWithCredit.length,
          withBudget: leadsWithBudget.length,
          qualifiedCount: qualifiedLeads.length,
          ghostingCount: ghostingLeads.length,
          activeCount: activeLeads.length,
          avgBudget: Math.round(avgBudget),
          temperatureBreakdown: {
            hot: hotLeads,
            warm: warmLeads,
            cold: coldLeads,
          },
        },
        
        messaging: {
          totalSent: outboundMessages.length,
          totalReceived: inboundMessages.length,
          aiResponses: aiResponses.length,
          humanResponses: humanResponses.length,
          responseRate: Math.round(responseRate * 10) / 10,
          creditsRemaining: wallet?.balance_messages || 0,
          creditsUsedThisPeriod,
          estimatedDaysLeft: Math.min(estimatedDaysLeft, 999),
        },
        
        dailyTrends,
        
        // === TOP PROPERTIES BY INTEREST ===
        topProperties: (() => {
          const propertyInterestMap: Record<string, number> = {};
          contacts.forEach(c => {
            if (c.re_property_interest_id) {
              propertyInterestMap[c.re_property_interest_id] = 
                (propertyInterestMap[c.re_property_interest_id] || 0) + 1;
            }
          });
          
          return Object.entries(propertyInterestMap)
            .map(([propId, count]) => {
              const prop = properties.find(p => p.id === propId);
              return {
                id: propId,
                title: prop?.title || 'Propiedad',
                zone: prop?.zone || '',
                interestedCount: count,
              };
            })
            .sort((a, b) => b.interestedCount - a.interestedCount)
            .slice(0, 10);
        })(),
        
        maxPropertyInterest: (() => {
          const propertyInterestMap: Record<string, number> = {};
          contacts.forEach(c => {
            if (c.re_property_interest_id) {
              propertyInterestMap[c.re_property_interest_id] = 
                (propertyInterestMap[c.re_property_interest_id] || 0) + 1;
            }
          });
          const counts = Object.values(propertyInterestMap);
          return counts.length > 0 ? Math.max(...counts) : 0;
        })(),
        
        // === RECENT ACTIVITY ===
        recentActivity: (() => {
          const recentAI = messages
            .filter(m => m.ai_generated && m.direction === 'outbound')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10)
            .map(m => {
              const contact = contacts.find(c => c.id === m.contact_id);
              return {
                id: m.id,
                type: 'ai_message' as const,
                description: `Mensaje IA enviado`,
                timestamp: m.created_at,
                contactName: contact?.name || 'Lead',
              };
            });
          return recentAI;
        })(),
        
        // === LEADS WITHOUT PROPERTY ===
        leadsWithoutProperty: contacts.filter(c => 
          !c.re_property_interest_id && 
          c.status === 'active' &&
          !['closed_won', 'closed_lost'].includes(c.pipeline_stage)
        ).length,
        
        alerts: {
          overdueFollowups: overdueFollowups.length,
          lowCredits,
          pendingVisits: todayEvents.length + scheduledEvents.length,
          unreadMessages,
          ghostingLeads: ghostingLeads.length,
        },
        
        periodDays: days,
        periodStart: startDate,
        periodEnd: endDate,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
