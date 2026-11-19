use std::collections::VecDeque;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

/// Sliding-window limiter: at most `max` acquisitions per rolling minute. Rejections are counted.
pub struct ReportLimiter {
    max: usize,
    window: Duration,
    recent: Mutex<VecDeque<Instant>>,
    dropped: AtomicUsize,
}

impl ReportLimiter {
    pub fn new(max_per_minute: usize) -> Self {
        Self {
            max: max_per_minute,
            window: Duration::from_secs(60),
            recent: Mutex::new(VecDeque::new()),
            dropped: AtomicUsize::new(0),
        }
    }

    pub fn try_acquire(&self) -> bool {
        let now = Instant::now();
        let mut recent = self.recent.lock().unwrap_or_else(|e| e.into_inner());
        while recent
            .front()
            .is_some_and(|t| now.duration_since(*t) > self.window)
        {
            recent.pop_front();
        }
        if recent.len() >= self.max {
            self.dropped.fetch_add(1, Ordering::Relaxed);
            return false;
        }
        recent.push_back(now);
        true
    }

    pub fn dropped(&self) -> usize {
        self.dropped.load(Ordering::Relaxed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_up_to_the_limit_then_counts_drops() {
        let limiter = ReportLimiter::new(2);
        assert!(limiter.try_acquire());
        assert!(limiter.try_acquire());
        assert!(!limiter.try_acquire());
        assert!(!limiter.try_acquire());
        assert_eq!(limiter.dropped(), 2);
    }
}
