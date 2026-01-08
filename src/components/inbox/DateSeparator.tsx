import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

interface DateSeparatorProps {
  date: Date;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const getLabel = () => {
    if (isToday(date)) return 'Hoy';
    if (isYesterday(date)) return 'Ayer';
    // Format: "lunes 22 dic"
    return format(date, "EEEE d MMM", { locale: es });
  };

  const label = getLabel();

  return (
    <div 
      className="flex items-center justify-center my-4"
      aria-label={`Mensajes del ${label}`}
    >
      <span className="px-3 py-1 text-xs bg-muted text-muted-foreground rounded-full capitalize">
        {label}
      </span>
    </div>
  );
}
