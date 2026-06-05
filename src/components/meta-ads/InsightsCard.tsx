import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CampaignInsights } from "@/hooks/useMetaAdsInsights";

const nf = new Intl.NumberFormat("es-MX");
function money(v: number) {
  return `$${v.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MXN`;
}

interface Props {
  insights: CampaignInsights | null | undefined;
  objective: "MESSAGES" | "LEAD_GENERATION";
  isLoading?: boolean;
}

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          emphasis
            ? "text-2xl font-semibold text-primary mt-1"
            : "text-xl font-semibold text-foreground mt-1"
        }
      >
        {value}
      </p>
    </Card>
  );
}

export function InsightsCard({ insights, objective, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-lg" />
        ))}
      </div>
    );
  }

  if (!insights) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Sin datos para este período. Las métricas pueden tardar hasta 24h en
          aparecer después de publicar la campaña.
        </p>
      </Card>
    );
  }

  const mainLabel =
    objective === "MESSAGES" ? "Conversaciones iniciadas" : "Leads captados";
  const mainValue = nf.format(
    objective === "MESSAGES" ? insights.messages_started : insights.leads,
  );
  const costLabel =
    objective === "MESSAGES" ? "Costo por conversación" : "Costo por lead";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Metric label={mainLabel} value={mainValue} emphasis />
      <Metric label="Impresiones" value={nf.format(insights.impressions)} />
      <Metric label="Clics" value={nf.format(insights.clicks)} />
      <Metric label="Gastado" value={money(insights.spend)} />
      <Metric label="Alcance" value={nf.format(insights.reach)} />
      <Metric label="CTR" value={`${insights.ctr.toFixed(2)}%`} />
      <Metric label="CPM" value={money(insights.cpm)} />
      <Metric
        label={costLabel}
        value={
          insights.cost_per_result != null
            ? money(insights.cost_per_result)
            : "—"
        }
      />
    </div>
  );
}