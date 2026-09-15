export interface ActionCard {
  label: string;
  confirmText: string;
  rejectText: string;
  execute: string;
  params: Record<string, any>;
}

export interface N8nResponse {
  text: string;
  actions?: ActionCard[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const sendPromptToN8n = async (prompt: string, history: ChatMessage[] = [], sessionId: string = "gestor-app"): Promise<N8nResponse> => {
  try {
    const webhookUrl = process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL || '';
    if (!webhookUrl) {
      throw new Error('URL do webhook n8n não configurada nas variáveis de ambiente.');
    }
    

    // Pegar apenas as últimas 4 mensagens de contexto para não estourar tokens do Groq
    const recentHistory = history.slice(-4);
    
    const payload = {
      prompt,
      history: recentHistory,
      sessionId,
      timestamp: new Date().toISOString()
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Erro N8N HTTP ${response.status}`);
    }
    
    const responseText = await response.text();
    let finalResponse: N8nResponse | null = null;
    
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.text !== undefined || parsed.actions !== undefined) {
        // Trata o caso de array retornado pelo n8n [ { text: '...', actions: [] } ]
        finalResponse = Array.isArray(parsed) ? parsed[0] : parsed;
      }
    } catch {}
    
    if (!finalResponse) {
      // Se não era um JSON válido, tenta extrair da string bruta
      const jsonMatch = responseText.match(/\{[\s\S]*"text"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[0]);
          if (extracted.text !== undefined) finalResponse = extracted;
        } catch {}
      }
    }

    if (finalResponse) {
      // Se o LLM alucinou um JSON dentro da string de texto, extrai ele de forma segura, independente da ordem das chaves
      if (typeof finalResponse.text === 'string') {
        const firstBrace = finalResponse.text.indexOf('{');
        const lastBrace = finalResponse.text.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const possibleJsonString = finalResponse.text.substring(firstBrace, lastBrace + 1);
            const innerExtracted = JSON.parse(possibleJsonString);
            
            if (innerExtracted.text !== undefined) {
              return innerExtracted;
            }
          } catch (e) {
            // Falhou no parse, segue o jogo e retorna o finalResponse original
          }
        }
      }
      return finalResponse;
    }
    
    return {
      text: responseText,
      actions: []
    };
  } catch (error) {
    console.error('Erro n8n:', error);
    return {
      text: "Erro de comunicação com a Inteligência Operacional. Verifique a conexão com o servidor.",
      actions: []
    };
  }
};