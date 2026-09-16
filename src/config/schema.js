const secretPattern = /(KEY|TOKEN|SECRET|PASSWORD|CONNECTION_STRING|AUTH|CREDENTIAL)/i;

export const CONFIG_SCHEMA = Object.freeze({
  NODE_ENV: { group: 'Runtime', type: 'select', options: ['development', 'production', 'test'], default: 'production' },
  PORT: { group: 'Runtime', type: 'number', default: 8787 },
  CORTEX_API_TOKEN: { group: 'Security', type: 'secret', required: true },
  OWNER_NUMBER: { group: 'Access', type: 'string', required: true },
  WHATSAPP_SESSIONS: { group: 'WhatsApp', type: 'list', default: ['main', 'assistant'] },
  WHATSAPP_ROLE_MODE: { group: 'WhatsApp', type: 'select', options: ['split', 'main-all', 'assistant-all'], default: 'split' },
  WHATSAPP_INBOX_SESSION: { group: 'WhatsApp', type: 'string', default: 'main' },
  WHATSAPP_AI_SESSION: { group: 'WhatsApp', type: 'string', default: 'assistant' },
  WHATSAPP_FALLBACK_ENABLED: { group: 'WhatsApp', type: 'boolean', default: true },
  NIGHT_WA_VERSION: { group: 'WhatsApp', type: 'string', required: false },
  AI_ENABLED: { group: 'AI', type: 'boolean', default: true },
  AI_DEFAULT_ROUTE: { group: 'AI', type: 'select', options: ['auto', 'groq', 'phi', 'deepseek'], default: 'auto' },
  DEEPSEEK_API_KEY: { group: 'DeepSeek', type: 'secret', required: false },
  DEEPSEEK_MONTHLY_CAP_USD: { group: 'DeepSeek', type: 'number', default: 2 },
  GROQ_API_KEYS: { group: 'Groq', type: 'secret-list', required: false },
  AZURE_CORE_ENDPOINT: { group: 'Azure Core', type: 'url', required: false },
  AZURE_CORE_KEY: { group: 'Azure Core', type: 'secret', required: false },
  AZURE_CORE_KEY_2: { group: 'Azure Core', type: 'secret', required: false },
  AZURE_CORE_REGION: { group: 'Azure Core', type: 'string', required: false },
  AZURE_PHI_DEPLOYMENT: { group: 'Azure Core', type: 'string', required: false },
  AZURE_IMAGE_ENDPOINT: { group: 'Azure Image', type: 'url', required: false },
  AZURE_IMAGE_KEY: { group: 'Azure Image', type: 'secret', required: false },
  AZURE_IMAGE_REGION: { group: 'Azure Image', type: 'string', required: false },
  AZURE_IMAGE_DEPLOYMENT: { group: 'Azure Image', type: 'string', required: false },
  AZURE_STORAGE_CONNECTION_STRING: { group: 'Blob Storage', type: 'secret', required: false },
  AZURE_STORAGE_CONTAINER: { group: 'Blob Storage', type: 'string', required: false },
  SUWAYOMI_BASE_URL: { group: 'Suwayomi', type: 'url', required: false },
  SUWAYOMI_USERNAME: { group: 'Suwayomi', type: 'string', required: false },
  SUWAYOMI_PASSWORD: { group: 'Suwayomi', type: 'secret', required: false }
});

export function inferUnknownEnv(name) {
  return { group: 'Unclassified', type: secretPattern.test(name) ? 'secret' : 'string', required: false, discovered: true };
}
