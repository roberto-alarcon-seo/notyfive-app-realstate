import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Loader2, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCampaigns } from "@/hooks/useCampaigns";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { CampaignListRow } from "@/components/campaigns/CampaignListRow";
import { CampaignWizard } from "@/components/campaigns/CampaignWizard";
import { CampaignBuilderMode } from "@/types/campaignBuilder";

export default function Campaigns() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<CampaignBuilderMode | undefined>(undefined);
  const { data: campaigns = [], isLoading } = useCampaigns(statusFilter);

  // Handle openWizard query param (from switching from assistant mode)
  useEffect(() => {
    const openWizard = searchParams.get('openWizard');
    if (openWizard === 'manual') {
      setWizardMode('manual');
      setWizardOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleOpenWizard = () => {
    setWizardMode(undefined);
    setWizardOpen(true);
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filters = [
    { value: "all", label: "Todas" },
    { value: "sending", label: "Activas" },
    { value: "scheduled", label: "Programadas" },
    { value: "draft", label: "Borradores" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campañas</h1>
            <p className="text-muted-foreground mt-1">Gestiona tus campañas de mensajes masivos</p>
          </div>
          <Button onClick={handleOpenWizard}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva campaña
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar campañas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <Badge
                key={f.value}
                variant={statusFilter === f.value ? "secondary" : "outline"}
                className="cursor-pointer"
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </Badge>
            ))}
          </div>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as "cards" | "list")}
            className="border border-border rounded-md"
          >
            <ToggleGroupItem value="cards" aria-label="Vista de tarjetas" className="px-3">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Vista de lista" className="px-3">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No hay campañas</p>
            <Button variant="outline" className="mt-4" onClick={handleOpenWizard}>
              Crear tu primera campaña
            </Button>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredCampaigns.map((campaign) => (
              <CampaignListRow key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>

      <CampaignWizard open={wizardOpen} onOpenChange={setWizardOpen} initialMode={wizardMode} />
    </div>
  );
}
