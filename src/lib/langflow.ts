export type LangflowRunResponse = {
  session_id?: string;
  outputs?: Array<{
    outputs?: Array<{
      results?: {
        message?: {
          text?: string;
        };
      };
    }>;
  }>;
};

export function extractLangflowText(data: LangflowRunResponse): string | null {
  const text = data.outputs?.[0]?.outputs?.[0]?.results?.message?.text;
  return text?.trim() ? text : null;
}

export function getLangflowConfig() {
  const baseUrl = process.env.LANGFLOW_URL ?? process.env.LANGFLOW_SERVER_URL;
  const flowId = process.env.LANGFLOW_FLOW_ID ?? process.env.FLOW_ID;
  const apiKey = process.env.LANGFLOW_API_KEY;

  return { baseUrl, flowId, apiKey };
}

export function isLangflowConfigured(): boolean {
  const { baseUrl, flowId, apiKey } = getLangflowConfig();
  return Boolean(baseUrl && flowId && apiKey);
}
