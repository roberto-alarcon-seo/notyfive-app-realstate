import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import jsPDF from "jspdf";
import { toast } from "@/hooks/use-toast";

interface DailyMetric {
  date: string;
  label: string;
  conversations: number;
  messagesSent: number;
  responses: number;
  delivered: number;
}

interface ExportReportButtonProps {
  dateRange: DateRange | undefined;
  dashboardRef: React.RefObject<HTMLDivElement>;
  analyticsData?: {
    totalConversations: number;
    totalMessages: number;
    inboundMessages: number;
    outboundMessages: number;
    responseRate: number;
    avgResponseTime: string;
    campaignsSent: number;
    campaignDeliveryRate: number;
    newContacts: number;
    totalContacts: number;
    walletBalance: number;
    walletSpent: number;
    approvedTemplates: number;
    pendingTemplates: number;
    dailyMetrics?: DailyMetric[];
  };
}

// Helper to draw a line chart
function drawLineChart(
  pdf: jsPDF,
  data: number[],
  labels: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  color: [number, number, number],
  showLabels = true
) {
  const padding = 10;
  const chartX = x + padding + 15;
  const chartY = y + padding + 15;
  const chartWidth = width - padding * 2 - 20;
  const chartHeight = height - padding * 2 - 30;
  
  // Title
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(50, 50, 50);
  pdf.text(title, x + padding, y + 12);
  
  // Background
  pdf.setFillColor(250, 250, 250);
  pdf.roundedRect(x, y, width, height, 3, 3, "F");
  
  // Draw grid lines
  pdf.setDrawColor(230, 230, 230);
  pdf.setLineWidth(0.2);
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const lineY = chartY + (chartHeight / gridLines) * i;
    pdf.line(chartX, lineY, chartX + chartWidth, lineY);
  }
  
  if (data.length === 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Sin datos disponibles", x + width / 2, y + height / 2, { align: "center" });
    return;
  }
  
  const maxValue = Math.max(...data, 1);
  const minValue = 0;
  const range = maxValue - minValue;
  
  // Y-axis labels
  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 120);
  for (let i = 0; i <= gridLines; i++) {
    const value = Math.round(maxValue - (range / gridLines) * i);
    const labelY = chartY + (chartHeight / gridLines) * i + 2;
    pdf.text(value.toString(), chartX - 3, labelY, { align: "right" });
  }
  
  // Draw line
  pdf.setDrawColor(...color);
  pdf.setLineWidth(0.8);
  
  const points: { x: number; y: number }[] = [];
  const step = chartWidth / Math.max(data.length - 1, 1);
  
  data.forEach((value, index) => {
    const pointX = chartX + step * index;
    const pointY = chartY + chartHeight - ((value - minValue) / range) * chartHeight;
    points.push({ x: pointX, y: pointY });
  });
  
  // Draw the line
  for (let i = 0; i < points.length - 1; i++) {
    pdf.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
  
  // Draw points
  pdf.setFillColor(...color);
  points.forEach(point => {
    pdf.circle(point.x, point.y, 1, "F");
  });
  
  // X-axis labels (show only some for readability)
  if (showLabels && labels.length > 0) {
    pdf.setFontSize(6);
    pdf.setTextColor(120, 120, 120);
    const labelStep = Math.max(Math.floor(labels.length / 6), 1);
    labels.forEach((label, index) => {
      if (index % labelStep === 0 || index === labels.length - 1) {
        const labelX = chartX + step * index;
        pdf.text(label, labelX, chartY + chartHeight + 8, { align: "center" });
      }
    });
  }
}

// Helper to draw a bar chart
function drawBarChart(
  pdf: jsPDF,
  data: { label: string; value: number; color: [number, number, number] }[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string
) {
  const padding = 10;
  const chartX = x + padding + 30;
  const chartY = y + padding + 15;
  const chartWidth = width - padding * 2 - 40;
  const chartHeight = height - padding * 2 - 25;
  
  // Title
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(50, 50, 50);
  pdf.text(title, x + padding, y + 12);
  
  // Background
  pdf.setFillColor(250, 250, 250);
  pdf.roundedRect(x, y, width, height, 3, 3, "F");
  
  if (data.length === 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Sin datos disponibles", x + width / 2, y + height / 2, { align: "center" });
    return;
  }
  
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const barHeight = (chartHeight - (data.length - 1) * 5) / data.length;
  
  data.forEach((item, index) => {
    const barY = chartY + index * (barHeight + 5);
    const barWidth = (item.value / maxValue) * chartWidth;
    
    // Label
    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);
    pdf.text(item.label, chartX - 5, barY + barHeight / 2 + 2, { align: "right" });
    
    // Bar
    pdf.setFillColor(...item.color);
    pdf.roundedRect(chartX, barY, Math.max(barWidth, 2), barHeight, 2, 2, "F");
    
    // Value
    pdf.setFontSize(7);
    pdf.setTextColor(60, 60, 60);
    pdf.text(item.value.toLocaleString(), chartX + barWidth + 3, barY + barHeight / 2 + 2);
  });
}

// Helper to draw a donut chart (simplified as pie)
function drawDonutChart(
  pdf: jsPDF,
  data: { label: string; value: number; color: [number, number, number] }[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string
) {
  const padding = 10;
  const centerX = x + width / 2;
  const centerY = y + height / 2 + 5;
  const radius = Math.min(width, height) / 2 - padding - 15;
  
  // Title
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(50, 50, 50);
  pdf.text(title, x + padding, y + 12);
  
  // Background
  pdf.setFillColor(250, 250, 250);
  pdf.roundedRect(x, y, width, height, 3, 3, "F");
  
  const total = data.reduce((sum, d) => sum + d.value, 0);
  
  if (total === 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Sin datos", centerX, centerY, { align: "center" });
    return;
  }
  
  let startAngle = -Math.PI / 2;
  
  data.forEach((item) => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    
    // Draw pie slice using lines (simplified)
    pdf.setFillColor(...item.color);
    pdf.setDrawColor(...item.color);
    
    // Create arc path manually with lines
    const steps = 30;
    const points: { x: number; y: number }[] = [{ x: centerX, y: centerY }];
    
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (sliceAngle * i) / steps;
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    }
    
    // Draw filled polygon
    if (points.length > 2) {
      pdf.setFillColor(...item.color);
      // Use lines to approximate the arc
      pdf.setLineWidth(0.1);
      for (let i = 1; i < points.length - 1; i++) {
        // Draw triangles from center
        const triangle = [
          [centerX, centerY],
          [points[i].x, points[i].y],
          [points[i + 1].x, points[i + 1].y],
        ];
        // Simple fill using multiple lines
        pdf.setDrawColor(...item.color);
        pdf.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      }
      
      // Fill with circle sectors
      pdf.setFillColor(...item.color);
      pdf.setLineWidth(radius / 2);
      pdf.setDrawColor(...item.color);
      
      // Draw thick arc line to simulate filled sector
      const midAngle = startAngle + sliceAngle / 2;
      const innerRadius = radius / 2;
      for (let i = 0; i < steps; i++) {
        const a1 = startAngle + (sliceAngle * i) / steps;
        const a2 = startAngle + (sliceAngle * (i + 1)) / steps;
        const x1 = centerX + Math.cos(a1) * innerRadius;
        const y1 = centerY + Math.sin(a1) * innerRadius;
        const x2 = centerX + Math.cos(a2) * innerRadius;
        const y2 = centerY + Math.sin(a2) * innerRadius;
        pdf.line(x1, y1, x2, y2);
      }
    }
    
    startAngle = endAngle;
  });
  
  // Draw white center for donut effect
  pdf.setFillColor(250, 250, 250);
  pdf.circle(centerX, centerY, radius * 0.5, "F");
  
  // Total in center
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(50, 50, 50);
  pdf.text(total.toLocaleString(), centerX, centerY + 2, { align: "center" });
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.text("Total", centerX, centerY + 7, { align: "center" });
  
  // Legend
  const legendY = y + height - 15;
  const legendX = x + 10;
  data.forEach((item, index) => {
    const itemX = legendX + index * (width / data.length);
    pdf.setFillColor(...item.color);
    pdf.rect(itemX, legendY, 4, 4, "F");
    pdf.setFontSize(6);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`${item.label}: ${item.value}`, itemX + 6, legendY + 3);
  });
}

export function ExportReportButton({ dateRange, analyticsData }: ExportReportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      toast({
        title: "Generando reporte",
        description: "Por favor espera mientras se genera el PDF...",
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const dateRangeText = dateRange?.from && dateRange?.to
        ? `${format(dateRange.from, "dd MMM yyyy", { locale: es })} - ${format(dateRange.to, "dd MMM yyyy", { locale: es })}`
        : "Último mes";

      // ============ PAGE 1: Metrics ============
      
      // Header background
      pdf.setFillColor(124, 58, 237); // Purple
      pdf.rect(0, 0, pageWidth, 45, "F");
      
      // Logo/Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("NotiFive", 15, 20);
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text("Reporte de Dashboard", 15, 28);
      
      pdf.setFontSize(10);
      pdf.text(`Período: ${dateRangeText}`, 15, 38);
      
      // Generated date on right
      pdf.setFontSize(9);
      pdf.text(`Generado: ${format(new Date(), "dd MMM yyyy HH:mm", { locale: es })}`, pageWidth - 15, 38, { align: "right" });

      let yPos = 60;
      const colWidth = (pageWidth - 40) / 2;

      // Section: Conversaciones y Mensajes
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Conversaciones y Mensajes", 15, yPos);
      yPos += 10;

      const metrics = [
        { label: "Total Conversaciones", value: analyticsData?.totalConversations?.toString() || "0" },
        { label: "Tasa de Respuesta", value: `${analyticsData?.responseRate?.toFixed(1) || 0}%` },
        { label: "Total Mensajes", value: analyticsData?.totalMessages?.toString() || "0" },
        { label: "Tiempo Promedio Respuesta", value: analyticsData?.avgResponseTime || "N/A" },
        { label: "Mensajes Entrantes", value: analyticsData?.inboundMessages?.toString() || "0" },
        { label: "Mensajes Salientes", value: analyticsData?.outboundMessages?.toString() || "0" },
      ];

      metrics.forEach((metric, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = 15 + col * (colWidth + 10);
        const y = yPos + row * 25;

        pdf.setFillColor(248, 248, 248);
        pdf.roundedRect(x, y, colWidth, 20, 3, 3, "F");

        pdf.setTextColor(120, 120, 120);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(metric.label, x + 5, y + 8);

        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(metric.value, x + 5, y + 16);
      });

      yPos += 85;

      // Section: Campañas
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Campañas", 15, yPos);
      yPos += 10;

      const campaignMetrics = [
        { label: "Campañas Enviadas", value: analyticsData?.campaignsSent?.toString() || "0" },
        { label: "Tasa de Entrega", value: `${analyticsData?.campaignDeliveryRate?.toFixed(1) || 0}%` },
      ];

      campaignMetrics.forEach((metric, index) => {
        const x = 15 + index * (colWidth + 10);

        pdf.setFillColor(248, 248, 248);
        pdf.roundedRect(x, yPos, colWidth, 20, 3, 3, "F");

        pdf.setTextColor(120, 120, 120);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(metric.label, x + 5, yPos + 8);

        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(metric.value, x + 5, yPos + 16);
      });

      yPos += 35;

      // Section: Contactos
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Contactos", 15, yPos);
      yPos += 10;

      const contactMetrics = [
        { label: "Nuevos Contactos", value: analyticsData?.newContacts?.toString() || "0" },
        { label: "Total Contactos", value: analyticsData?.totalContacts?.toString() || "0" },
      ];

      contactMetrics.forEach((metric, index) => {
        const x = 15 + index * (colWidth + 10);

        pdf.setFillColor(248, 248, 248);
        pdf.roundedRect(x, yPos, colWidth, 20, 3, 3, "F");

        pdf.setTextColor(120, 120, 120);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(metric.label, x + 5, yPos + 8);

        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(metric.value, x + 5, yPos + 16);
      });

      yPos += 35;

      // Section: Wallet
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Wallet", 15, yPos);
      yPos += 10;

      const walletMetrics = [
        { label: "Balance Actual", value: `${analyticsData?.walletBalance?.toLocaleString() || 0} msgs` },
        { label: "Consumido en Período", value: `${analyticsData?.walletSpent?.toLocaleString() || 0} msgs` },
      ];

      walletMetrics.forEach((metric, index) => {
        const x = 15 + index * (colWidth + 10);

        pdf.setFillColor(248, 248, 248);
        pdf.roundedRect(x, yPos, colWidth, 20, 3, 3, "F");

        pdf.setTextColor(120, 120, 120);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(metric.label, x + 5, yPos + 8);

        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(metric.value, x + 5, yPos + 16);
      });

      yPos += 35;

      // Section: Templates
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Templates", 15, yPos);
      yPos += 10;

      const templateMetrics = [
        { label: "Templates Aprobados", value: analyticsData?.approvedTemplates?.toString() || "0" },
        { label: "Templates Pendientes", value: analyticsData?.pendingTemplates?.toString() || "0" },
      ];

      templateMetrics.forEach((metric, index) => {
        const x = 15 + index * (colWidth + 10);

        pdf.setFillColor(248, 248, 248);
        pdf.roundedRect(x, yPos, colWidth, 20, 3, 3, "F");

        pdf.setTextColor(120, 120, 120);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(metric.label, x + 5, yPos + 8);

        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(metric.value, x + 5, yPos + 16);
      });

      // Footer Page 1
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text("Página 1 de 2", pageWidth / 2, pageHeight - 10, { align: "center" });

      // ============ PAGE 2: Charts ============
      pdf.addPage();
      
      // Header for page 2
      pdf.setFillColor(124, 58, 237);
      pdf.rect(0, 0, pageWidth, 30, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("NotiFive - Gráficos de Tendencias", 15, 18);
      
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Período: ${dateRangeText}`, pageWidth - 15, 18, { align: "right" });

      // Prepare chart data
      const dailyMetrics = analyticsData?.dailyMetrics || [];
      const labels = dailyMetrics.map(m => m.label);
      const conversationsData = dailyMetrics.map(m => m.conversations);
      const messagesSentData = dailyMetrics.map(m => m.messagesSent);
      const responsesData = dailyMetrics.map(m => m.responses);
      const deliveredData = dailyMetrics.map(m => m.delivered);

      const chartWidth = (pageWidth - 30) / 2;
      const chartHeight = 60;
      let chartY = 40;

      // Chart 1: Conversaciones por día
      drawLineChart(
        pdf,
        conversationsData,
        labels,
        10,
        chartY,
        chartWidth,
        chartHeight,
        "Conversaciones por Día",
        [124, 58, 237], // Purple
        true
      );

      // Chart 2: Mensajes Enviados
      drawLineChart(
        pdf,
        messagesSentData,
        labels,
        pageWidth / 2 + 5,
        chartY,
        chartWidth,
        chartHeight,
        "Mensajes Enviados por Día",
        [59, 130, 246], // Blue
        true
      );

      chartY += chartHeight + 15;

      // Chart 3: Respuestas recibidas
      drawLineChart(
        pdf,
        responsesData,
        labels,
        10,
        chartY,
        chartWidth,
        chartHeight,
        "Respuestas Recibidas por Día",
        [16, 185, 129], // Green
        true
      );

      // Chart 4: Mensajes Entregados
      drawLineChart(
        pdf,
        deliveredData,
        labels,
        pageWidth / 2 + 5,
        chartY,
        chartHeight,
        chartHeight,
        "Entregados por Día",
        [245, 158, 11], // Amber
        true
      );

      chartY += chartHeight + 15;

      // Chart 5: Resumen de métricas (bar chart)
      drawBarChart(
        pdf,
        [
          { label: "Enviados", value: analyticsData?.outboundMessages || 0, color: [59, 130, 246] },
          { label: "Entregados", value: dailyMetrics.reduce((sum, m) => sum + m.delivered, 0), color: [16, 185, 129] },
          { label: "Respuestas", value: analyticsData?.inboundMessages || 0, color: [124, 58, 237] },
        ],
        10,
        chartY,
        chartWidth,
        55,
        "Resumen de Mensajes"
      );

      // Chart 6: Distribución de mensajes (donut)
      drawDonutChart(
        pdf,
        [
          { label: "Entrantes", value: analyticsData?.inboundMessages || 0, color: [16, 185, 129] },
          { label: "Salientes", value: analyticsData?.outboundMessages || 0, color: [59, 130, 246] },
        ],
        pageWidth / 2 + 5,
        chartY,
        chartWidth,
        55,
        "Distribución de Mensajes"
      );

      // Footer Page 2
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text("Generado automáticamente por NotiFive", pageWidth / 2, pageHeight - 15, { align: "center" });
      pdf.text("Página 2 de 2", pageWidth / 2, pageHeight - 10, { align: "center" });

      // Download
      const fileName = `notyfive-report-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`;
      pdf.save(fileName);

      toast({
        title: "Reporte exportado",
        description: `Se ha descargado ${fileName} (2 páginas)`,
      });
    } catch (error) {
      console.error("Error exporting report:", error);
      toast({
        title: "Error al exportar",
        description: "No se pudo generar el PDF. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className="gap-2"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="hidden sm:inline">Exportando...</span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Exportar PDF</span>
        </>
      )}
    </Button>
  );
}
