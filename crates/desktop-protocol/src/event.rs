use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::display::Display;
use crate::settings::Settings;

/// Tauri event channel carrying every [`EngineEvent`]. Characters limited to what Tauri allows.
pub const ENGINE_EVENT_CHANNEL: &str = "engine:event";

/// All state changes are observable through engine events (plan §4.1 rules).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", content = "payload", rename_all = "camelCase")]
#[ts(export)]
pub enum EngineEvent {
    /// Settings were changed (by any window). Carries the full new settings.
    SettingsChanged(Settings),
    /// The monitor topology or properties changed. Carries the full new list.
    DisplaysChanged(Vec<Display>),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn events_are_tagged_unions() {
        let json = serde_json::to_value(EngineEvent::DisplaysChanged(vec![])).unwrap();
        assert_eq!(
            json,
            serde_json::json!({"type": "displaysChanged", "payload": []})
        );
    }
}
