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

fn reviews_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?
        .join("reviews");
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Unable to create review storage: {error}"))?;
    Ok(dir)
}

fn reviews_index_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(reviews_dir(app)?.join("index.json"))
}

fn review_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if !is_safe_review_id(id) {
        return Err(format!("Unsupported review id: {id}"));
    }

    Ok(reviews_dir(app)?.join(format!("{id}.json")))
}

fn is_safe_review_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
}

fn review_summary(review: &serde_json::Value) -> serde_json::Value {
    let mut summary = serde_json::Map::new();
    for key in [
        "id",
        "fileName",
        "fileType",
        "fileSize",
        "duration",
        "status",
        "createdAt",
        "updatedAt",
        "providerSnapshot",
        "transcriptPreview",
        "feedbackPreview",
    ] {
        if let Some(value) = review.get(key) {
            summary.insert(key.to_string(), value.clone());
        }
    }
    serde_json::Value::Object(summary)
}

fn read_review_index(app: &AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let path = reviews_index_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path)
        .map_err(|error| format!("Unable to read review index: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Unable to parse review index: {error}"))
}

fn write_review_index(app: &AppHandle, reviews: &[serde_json::Value]) -> Result<(), String> {
    let path = reviews_index_path(app)?;
    let content = serde_json::to_string_pretty(reviews)
        .map_err(|error| format!("Unable to serialize review index: {error}"))?;
    fs::write(path, content).map_err(|error| format!("Unable to write review index: {error}"))
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

#[tauri::command]
fn list_reviews(app: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let mut reviews = read_review_index(&app)?;
    reviews.sort_by(|left, right| {
        let left_updated = left
            .get("updatedAt")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        let right_updated = right
            .get("updatedAt")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        right_updated.cmp(left_updated)
    });
    Ok(reviews)
}

#[tauri::command]
fn load_review(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    let path = review_path(&app, &id)?;
    let content = fs::read_to_string(path)
        .map_err(|error| format!("Unable to read review: {error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("Unable to parse review: {error}"))
}

#[tauri::command]
fn save_review(app: AppHandle, review: serde_json::Value) -> Result<(), String> {
    let id = review
        .get("id")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "Review id is required".to_string())?;
    let path = review_path(&app, id)?;
    let content = serde_json::to_string_pretty(&review)
        .map_err(|error| format!("Unable to serialize review: {error}"))?;
    fs::write(path, content).map_err(|error| format!("Unable to write review: {error}"))?;

    let summary = review_summary(&review);
    let mut index = read_review_index(&app)?
        .into_iter()
        .filter(|item| item.get("id").and_then(serde_json::Value::as_str) != Some(id))
        .collect::<Vec<_>>();
    index.push(summary);
    write_review_index(&app, &index)
}

#[tauri::command]
fn delete_review(app: AppHandle, id: String) -> Result<(), String> {
    let path = review_path(&app, &id)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("Unable to delete review: {error}"))?;
    }

    let index = read_review_index(&app)?
        .into_iter()
        .filter(|item| item.get("id").and_then(serde_json::Value::as_str) != Some(id.as_str()))
        .collect::<Vec<_>>();
    write_review_index(&app, &index)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            health,
            load_api_keys,
            save_api_key,
            list_reviews,
            load_review,
            save_review,
            delete_review
        ])
        .run(tauri::generate_context!())
        .expect("error while running IELTS Speaking Copilot");
}
