import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalText, contactName, companyName, tone } = await req.json();

    if (!originalText || originalText.length < 10) {
      return new Response(
        JSON.stringify({ error: 'El texto debe tener al menos 10 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const toneInstruction = tone === 'informal'
      ? '- Usa un tono informal, tutea al cliente (habla de "tú"), sé cercano y amigable pero profesional'
      : '- Usa un tono formal, trata al cliente de "usted", sé profesional y respetuoso';

    const systemPrompt = `Eres un asistente de redacción para agentes humanos de atención al cliente.
Tu tarea es mejorar la claridad, ortografía y tono del mensaje, manteniendo EXACTAMENTE la intención original.
No agregues información nueva ni promesas.

Instrucciones:
- Corrige errores ortográficos y gramaticales
- Mejora la claridad del mensaje
${toneInstruction}
- Mantén el idioma original del texto
- No inventes datos
- No hagas preguntas adicionales
- Si el mensaje ya está bien escrito, realiza mejoras mínimas o devuélvelo tal cual
- Mantén el mensaje conciso, no lo hagas más largo innecesariamente`;

    const userPrompt = `Mejora este mensaje de atención al cliente:

Texto original: "${originalText}"
${contactName ? `Nombre del cliente: ${contactName}` : ''}
${companyName ? `Nombre de la empresa: ${companyName}` : ''}

Responde SOLO con el texto mejorado, sin explicaciones ni comillas adicionales.`;

    console.log('Calling Lovable AI for text improvement...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Límite de solicitudes alcanzado, intenta de nuevo en unos segundos' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA agotados' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Error al procesar la solicitud de IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const improvedText = data.choices?.[0]?.message?.content?.trim();

    if (!improvedText) {
      console.error('No content in AI response:', data);
      return new Response(
        JSON.stringify({ error: 'No se pudo obtener una respuesta de IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Text improved successfully');

    return new Response(
      JSON.stringify({ improved_text: improvedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-rewrite-text:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
