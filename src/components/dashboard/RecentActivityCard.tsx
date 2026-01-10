import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ActivityItem {
  id: string;
  type: 'ai_message' | 'new_lead' | 'followup' | 'visit' | 'conversion';
  description: string;
  timestamp: string;
  contactName?: string;
}

interface RecentActivityCardProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

export function RecentActivityCard({ activities, isLoading }: RecentActivityCardProps) {
  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Actividad Reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay actividad reciente
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'ai_message':
        return <MessageSquare className="h-4 w-4 text-primary" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getDescription = (activity: ActivityItem) => {
    if (activity.type === 'ai_message' && activity.contactName) {
      return `Mensaje IA enviado para ${activity.contactName}`;
    }
    return activity.description;
  };

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.slice(0, 8).map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-md bg-primary/10">
              {getIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {getDescription(activity)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.timestamp), { 
                  addSuffix: true, 
                  locale: es 
                })}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
