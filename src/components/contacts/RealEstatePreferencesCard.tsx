import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Plus } from "lucide-react";

export interface RealEstatePreferencesData {
  re_property_types: string[];
  re_bedrooms: number | null;
  re_bathrooms: number | null;
  re_parking_spots: number | null;
  re_requires_parking: boolean;
  re_zones: string[];
  re_amenities: string[];
  re_accepts_pets: boolean;
  re_reason: 'BUY' | 'RENT' | 'INVEST' | 'MOVE' | 'UPGRADE' | 'DOWNSIZE' | 'OTHER' | null;
  re_current_situation: 'RENTING' | 'OWNING' | 'LIVING_WITH_FAMILY' | 'LOOKING_TO_MOVE' | 'OTHER' | null;
}

interface RealEstatePreferencesCardProps {
  data: RealEstatePreferencesData;
  onChange: (data: RealEstatePreferencesData) => void;
}

const PROPERTY_TYPES = ['Casa', 'Departamento', 'Terreno', 'Penthouse', 'Loft', 'Townhouse'];

const AMENITIES = [
  'Gimnasio', 'Alberca', 'Seguridad 24/7', 'Área de juegos', 'Salón de eventos',
  'Roof garden', 'Elevador', 'Estacionamiento visitas', 'Bodega', 'Cuarto de servicio'
];

const REASON_LABELS: Record<string, string> = {
  BUY: 'Comprar',
  RENT: 'Rentar',
  INVEST: 'Invertir',
  MOVE: 'Mudarse',
  UPGRADE: 'Mejorar',
  DOWNSIZE: 'Reducir',
  OTHER: 'Otro',
};

const SITUATION_LABELS: Record<string, string> = {
  RENTING: 'Renta actualmente',
  OWNING: 'Es propietario',
  LIVING_WITH_FAMILY: 'Vive con familia',
  LOOKING_TO_MOVE: 'Busca mudarse',
  OTHER: 'Otro',
};

export function RealEstatePreferencesCard({ data, onChange }: RealEstatePreferencesCardProps) {
  const [zoneInput, setZoneInput] = useState('');

  const updateField = <K extends keyof RealEstatePreferencesData>(field: K, value: RealEstatePreferencesData[K]) => {
    onChange({ ...data, [field]: value });
  };

  const toggleArrayItem = (field: 're_property_types' | 're_amenities', item: string) => {
    const current = data[field] || [];
    if (current.includes(item)) {
      updateField(field, current.filter(i => i !== item));
    } else {
      updateField(field, [...current, item]);
    }
  };

  const addZone = () => {
    if (zoneInput.trim() && !data.re_zones.includes(zoneInput.trim())) {
      updateField('re_zones', [...data.re_zones, zoneInput.trim()]);
      setZoneInput('');
    }
  };

  const removeZone = (zone: string) => {
    updateField('re_zones', data.re_zones.filter(z => z !== zone));
  };

  const parseNumber = (value: string): number | null => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : Math.max(0, parsed);
  };

  return (
    <div className="space-y-6">
      {/* Section: Tipo y distribución */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground border-b border-border pb-2">Tipo y distribución</h4>
        
        {/* Property Types */}
        <div className="space-y-2">
          <Label>Tipo de propiedad</Label>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map(type => (
              <Badge
                key={type}
                variant={data.re_property_types?.includes(type) ? "default" : "outline"}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => toggleArrayItem('re_property_types', type)}
              >
                {type}
              </Badge>
            ))}
          </div>
        </div>

        {/* Distribution: Recámaras, Baños, Estacionamientos */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="re_bedrooms">Recámaras</Label>
            <Input
              id="re_bedrooms"
              type="number"
              min={0}
              placeholder="0"
              value={data.re_bedrooms ?? ''}
              onChange={(e) => updateField('re_bedrooms', parseNumber(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="re_bathrooms">Baños</Label>
            <Input
              id="re_bathrooms"
              type="number"
              min={0}
              step={0.5}
              placeholder="0"
              value={data.re_bathrooms ?? ''}
              onChange={(e) => updateField('re_bathrooms', parseNumber(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="re_parking_spots">Estacionamientos</Label>
            <Input
              id="re_parking_spots"
              type="number"
              min={0}
              placeholder="0"
              value={data.re_parking_spots ?? ''}
              onChange={(e) => updateField('re_parking_spots', parseNumber(e.target.value))}
            />
          </div>
        </div>

        {/* Requires Parking toggle */}
        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50">
          <Label htmlFor="re_requires_parking" className="text-sm font-medium">Requiere estacionamiento</Label>
          <Switch
            id="re_requires_parking"
            checked={data.re_requires_parking}
            onCheckedChange={(v) => updateField('re_requires_parking', v)}
          />
        </div>
      </div>

      {/* Section: Zonas y amenidades */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground border-b border-border pb-2">Zonas y amenidades</h4>
        
        {/* Zones */}
        <div className="space-y-2">
          <Label>Zonas de interés</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Polanco, Roma Norte, Condesa..."
              value={zoneInput}
              onChange={(e) => setZoneInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addZone())}
            />
            <Button type="button" variant="secondary" size="icon" onClick={addZone}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {data.re_zones.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {data.re_zones.map(zone => (
                <Badge key={zone} variant="secondary" className="px-2 py-1 flex items-center gap-1">
                  {zone}
                  <button onClick={() => removeZone(zone)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Amenities */}
        <div className="space-y-2">
          <Label>Amenidades</Label>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map(amenity => (
              <Badge
                key={amenity}
                variant={data.re_amenities?.includes(amenity) ? "default" : "outline"}
                className="cursor-pointer text-xs hover:opacity-80 transition-opacity"
                onClick={() => toggleArrayItem('re_amenities', amenity)}
              >
                {amenity}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Section: Contexto */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground border-b border-border pb-2">Contexto</h4>
        
        {/* Pets toggle */}
        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50">
          <Label htmlFor="re_accepts_pets" className="text-sm font-medium">Acepta mascotas</Label>
          <Switch
            id="re_accepts_pets"
            checked={data.re_accepts_pets}
            onCheckedChange={(v) => updateField('re_accepts_pets', v)}
          />
        </div>

        {/* Reason + Situation */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="re_reason">Motivo</Label>
            <Select 
              value={data.re_reason ?? ''} 
              onValueChange={(v) => updateField('re_reason', v as RealEstatePreferencesData['re_reason'])}
            >
              <SelectTrigger id="re_reason">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REASON_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="re_current_situation">Situación actual</Label>
            <Select 
              value={data.re_current_situation ?? ''} 
              onValueChange={(v) => updateField('re_current_situation', v as RealEstatePreferencesData['re_current_situation'])}
            >
              <SelectTrigger id="re_current_situation">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SITUATION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
