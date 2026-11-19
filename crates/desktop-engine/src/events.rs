use desktop_protocol::EngineEvent;
use tokio::sync::broadcast;

/// Fan-out of engine events. Slow subscribers lose the oldest events rather than blocking the
/// engine; every event carries full state, so a lagging subscriber still converges.
pub struct EventBus {
    tx: broadcast::Sender<EngineEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(64);
        Self { tx }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<EngineEvent> {
        self.tx.subscribe()
    }

    pub fn publish(&self, event: EngineEvent) {
        // `send` fails only when nobody is subscribed (e.g. the UI is reloading). That is a
        // normal state, not an error: state is re-read when the UI reconnects.
        if self.tx.send(event).is_err() {
            tracing::trace!("engine event dropped: no subscribers");
        }
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}
