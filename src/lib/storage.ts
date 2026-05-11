import type { AppSettings } from './types';

const SETTINGS_KEY = 'ielts-speaking-copilot.settings.v0.1';
const apiKeyProviders = ['openai', 'groq', 'gemini', 'nvidia'] as const;

export const defaultSettings: AppSettings = {
  asrProvider: 'mock',
  asrModel: 'gpt-4o-mini-transcribe',
  llmProvider: 'mock',
  llmModel: 'gpt-4o-mini',
  appearance: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 'medium',
    themeColor: '#6366f1',
    language: 'zh'
  },
  apiKeys: {
    openai: '',
    groq: '',
    gemini: '',
    nvidia: ''
  },
  limits: {
    maxFileSizeMb: 25,
    maxDurationMinutes: 20
  }
};

type StoredSettings = Partial<AppSettings> & {
  apiKey?: string;
};

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch {
    return null;
  }
}

function withoutApiKeys(settings: AppSettings): AppSettings {
  return {
    ...settings,
    apiKeys: defaultSettings.apiKeys
  };
}

function normalizeSettings(raw: StoredSettings, apiKeys: AppSettings['apiKeys'] = defaultSettings.apiKeys): AppSettings {
  const legacyKey = raw.apiKey ?? '';
  const mergedApiKeys = {
    ...defaultSettings.apiKeys,
    ...apiKeys
  };

  if (legacyKey && !mergedApiKeys.openai) {
    mergedApiKeys.openai = legacyKey;
  }

  return {
    ...defaultSettings,
    ...raw,
    asrProvider: raw.asrProvider ?? defaultSettings.asrProvider,
    llmProvider: raw.llmProvider ?? defaultSettings.llmProvider,
    apiKeys: mergedApiKeys,
    appearance: {
      ...defaultSettings.appearance,
      ...raw.appearance
    },
    limits: {
      ...defaultSettings.limits,
      ...raw.limits
    }
  };
}

async function loadApiKeys(): Promise<AppSettings['apiKeys']> {
  const stored = await invokeTauri<Partial<AppSettings['apiKeys']>>('load_api_keys');
  return {
    ...defaultSettings.apiKeys,
    ...stored
  };
}

async function saveApiKeys(apiKeys: AppSettings['apiKeys']): Promise<void> {
  await Promise.all(
    apiKeyProviders.map((provider) =>
      invokeTauri('save_api_key', {
        provider,
        key: apiKeys[provider]
      })
    )
  );
}

function getStoredSettings(): StoredSettings | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSettings;
  } catch {
    return null;
  }
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = getStoredSettings();
  if (!raw) {
    return {
      ...defaultSettings,
      apiKeys: await loadApiKeys()
    };
  }

  const desktopKeys = await loadApiKeys();
  const legacyKeys = {
    ...defaultSettings.apiKeys,
    ...raw.apiKeys
  };
  const apiKeys = apiKeyProviders.some((provider) => desktopKeys[provider])
    ? desktopKeys
    : legacyKeys;
  const settings = normalizeSettings(raw, apiKeys);

  if (raw.apiKey || raw.apiKeys) {
    await saveApiKeys(settings.apiKeys);
    await saveSettings(settings);
  }

  return settings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(withoutApiKeys(settings)));
  await saveApiKeys(settings.apiKeys);
}
