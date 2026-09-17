const secretPattern = /(KEY|TOKEN|SECRET|PASSWORD|CONNECTION_STRING|AUTH|CREDENTIAL)/i;

const HOT = 'hot';
const RESTART = 'restart';

export const CONFIG_SCHEMA = Object.freeze({
  NODE_ENV: { group: 'Runtime', type: 'select', options: ['development', 'production', 'test'], default: 'production', apply: RESTART },
  SERVER_PORT: { group: 'Runtime', type: 'number', required: false, apply: RESTART },
  PORT: { group: 'Runtime', type: 'number', default: 8787, required: false, apply: RESTART },
  CORTEX_API_TOKEN: { group: 'Security', type: 'secret', required: true, apply: RESTART },
  OWNER_NUMBER: { group: 'Access', type: 'string', required: true, apply: RESTART },

  WHATSAPP_SESSIONS: { group: 'WhatsApp', type: 'list', default: ['main', 'assistant'], apply: RESTART },
  WHATSAPP_ROLE_MODE: { group: 'WhatsApp', type: 'select', options: ['split', 'main-all', 'assistant-all'], default: 'split', apply: HOT },
  WHATSAPP_INBOX_SESSION: { group: 'WhatsApp', type: 'string', default: 'main', apply: HOT },
  WHATSAPP_AI_SESSION: { group: 'WhatsApp', type: 'string', default: 'assistant', apply: HOT },
  WHATSAPP_FALLBACK_ENABLED: { group: 'WhatsApp', type: 'boolean', default: true, apply: HOT },
  PAIRING_SESSION: { group: 'WhatsApp', type: 'string', default: 'main', required: false, apply: RESTART },
  PAIRING_PHONE_NUMBER: { group: 'WhatsApp', type: 'string', required: false, apply: RESTART },
  NIGHT_WA_VERSION: { group: 'WhatsApp', type: 'string', required: false, apply: RESTART },

  AI_ENABLED: { group: 'AI', type: 'boolean', default: true, apply: HOT },
  AI_DEFAULT_ROUTE: { group: 'AI', type: 'select', options: ['auto', 'groq', 'phi', 'deepseek'], default: 'auto', apply: HOT },
  DEEPSEEK_API_KEY: { group: 'DeepSeek', type: 'secret', required: false, apply: RESTART },
  DEEPSEEK_MONTHLY_CAP_USD: { group: 'DeepSeek', type: 'number', default: 2, apply: HOT },
  GROQ_API_KEY: { group: 'Groq', type: 'secret', required: false, apply: RESTART },
  GROQ_API_KEYS: { group: 'Groq', type: 'secret-list', required: false, apply: RESTART },
  GROQ_MODEL: { group: 'Groq', type: 'string', default: 'openai/gpt-oss-120b', apply: HOT },
  GROQ_SEARCH_MODEL: { group: 'Groq', type: 'string', default: 'groq/compound-mini', apply: HOT },
  GROQ_MAX_TOKENS: { group: 'Groq', type: 'number', default: 1800, apply: HOT },

  AZURE_CORE_ENDPOINT: { group: 'Azure Core', type: 'url', required: false, apply: RESTART },
  AZURE_CORE_KEY: { group: 'Azure Core', type: 'secret', required: false, apply: RESTART },
  AZURE_CORE_KEY_2: { group: 'Azure Core', type: 'secret', required: false, apply: RESTART },
  AZURE_CORE_REGION: { group: 'Azure Core', type: 'string', required: false, apply: RESTART },
  AZURE_PHI_DEPLOYMENT: { group: 'Azure Core', type: 'string', required: false, apply: RESTART },

  AZURE_IMAGE_ENDPOINT: { group: 'Azure Image', type: 'url', required: false, apply: RESTART },
  AZURE_IMAGE_KEY: { group: 'Azure Image', type: 'secret', required: false, apply: RESTART },
  AZURE_IMAGE_REGION: { group: 'Azure Image', type: 'string', required: false, apply: RESTART },
  AZURE_IMAGE_DEPLOYMENT: { group: 'Azure Image', type: 'string', required: false, apply: RESTART },

  AZURE_STORAGE_CONNECTION_STRING: { group: 'Blob Storage', type: 'secret', required: false, apply: RESTART },
  AZURE_STORAGE_CONTAINER: { group: 'Blob Storage', type: 'string', required: false, apply: RESTART },

  SUWAYOMI_BASE_URL: { group: 'Suwayomi', type: 'url', required: false, apply: RESTART },
  SUWAYOMI_USERNAME: { group: 'Suwayomi', type: 'string', required: false, apply: RESTART },
  SUWAYOMI_PASSWORD: { group: 'Suwayomi', type: 'secret', required: false, apply: RESTART }
});

export function inferUnknownEnv(name) {
  return {
    group: 'Unclassified',
    type: secretPattern.test(name) ? 'secret' : 'string',
    required: false,
    discovered: true,
    apply: RESTART
  };
}
