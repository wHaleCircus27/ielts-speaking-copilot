use std::{collections::HashMap, fs, path::PathBuf};

use keyring::Entry;
use tauri::{AppHandle, Manager};

const KEYRING_SERVICE: &str = "com.ieltsspeaking.copilot.api-key";
const API_KEY_PROVIDERS: [&str; 4] = ["openai", "groq", "gemini", "nvidia"];

#[tauri::command]
fn health() -> &'static str {
    "ok"
}

fn api_keys_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Unable to create app data directory: {error}"))?;
    Ok(dir.join("api-keys.local.json"))
}

fn read_api_key_map(app: &AppHandle) -> Result<HashMap<String, String>, String> {
    let path = api_keys_path(app)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }

    let content = fs::read_to_string(path)
        .map_err(|error| format!("Unable to read API key storage: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Unable to parse API key storage: {error}"))
}

fn is_supported_provider(provider: &str) -> bool {
    API_KEY_PROVIDERS.contains(&provider)
}

fn keyring_entry(provider: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, provider)
        .map_err(|error| format!("Unable to open secure API key storage: {error}"))
}

fn read_secure_api_key(provider: &str) -> Result<Option<String>, String> {
    let entry = keyring_entry(provider)?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Unable to read secure API key storage: {error}")),
    }
}

fn save_secure_api_key(provider: &str, key: &str) -> Result<(), String> {
    let entry = keyring_entry(provider)?;
    if key.trim().is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!("Unable to delete secure API key storage: {error}")),
        }
    } else {
        entry
            .set_password(key.trim())
            .map_err(|error| format!("Unable to write secure API key storage: {error}"))
    }
}

fn migrate_local_api_keys(app: &AppHandle) -> Result<(), String> {
    let legacy_keys = read_api_key_map(app)?;
    if legacy_keys.is_empty() {
        return Ok(());
    }

    for (provider, key) in legacy_keys {
        if is_supported_provider(&provider) && read_secure_api_key(&provider)?.is_none() {
            save_secure_api_key(&provider, &key)?;
        }
    }

    Ok(())
}

#[tauri::command]
fn load_api_keys(app: AppHandle) -> Result<HashMap<String, String>, String> {
    migrate_local_api_keys(&app)?;
    let mut keys = HashMap::new();
    for provider in API_KEY_PROVIDERS {
        if let Some(key) = read_secure_api_key(provider)? {
            keys.insert(provider.to_string(), key);
        }
    }
    Ok(keys)
}

#[tauri::command]
fn save_api_key(app: AppHandle, provider: String, key: String) -> Result<(), String> {
    if !is_supported_provider(&provider) {
        return Err(format!("Unsupported provider: {provider}"));
    }

    migrate_local_api_keys(&app)?;
    save_secure_api_key(&provider, &key)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![health, load_api_keys, save_api_key])
        .run(tauri::generate_context!())
        .expect("error while running IELTS Speaking Copilot");
}
