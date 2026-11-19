use desktop_protocol::{Display, Rect};
use platform_windows::{PixelRect, RawMonitor};

/// Converts Windows' monitor records into the protocol model, ordered like Windows numbers them
/// (`DISPLAY1`, `DISPLAY2`, …) with the left-most monitor first as a tie-break.
pub fn map_monitors(raw: Vec<RawMonitor>) -> Vec<Display> {
    let mut displays: Vec<(u32, Display)> = raw
        .into_iter()
        .enumerate()
        .map(|(position, m)| {
            // Windows numbering when the device name carries one; otherwise enumeration order.
            let number = display_number(&m.device_name)
                .unwrap_or_else(|| u32::try_from(position + 1).unwrap_or(u32::MAX));
            (number, to_display(m, number))
        })
        .collect();
    displays.sort_by_key(|(number, d)| (*number, d.bounds.x, d.bounds.y));
    displays.into_iter().map(|(_, d)| d).collect()
}

fn to_display(m: RawMonitor, number: u32) -> Display {
    Display {
        id: m.device_name.clone(),
        label: format!("Display {number}"),
        device_name: m.device_name,
        is_primary: m.is_primary,
        bounds: to_rect(m.bounds),
        work_area: to_rect(m.work_area),
        // 96 DPI is 100%. Missing data degrades to 100% rather than guessing.
        dpi_scale: m.effective_dpi.map_or(1.0, |dpi| dpi as f32 / 96.0),
        refresh_rate_hz: m.refresh_rate_hz,
    }
}

fn to_rect(r: PixelRect) -> Rect {
    Rect {
        x: r.left,
        y: r.top,
        width: u32::try_from(r.right.saturating_sub(r.left)).unwrap_or(0),
        height: u32::try_from(r.bottom.saturating_sub(r.top)).unwrap_or(0),
    }
}

/// `\\.\DISPLAY12` → `Some(12)`.
fn display_number(device_name: &str) -> Option<u32> {
    let upper = device_name.to_ascii_uppercase();
    let digits = upper.rsplit_once("DISPLAY")?.1;
    digits.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw(name: &str, primary: bool, left: i32, dpi: Option<u32>) -> RawMonitor {
        RawMonitor {
            device_name: name.into(),
            is_primary: primary,
            bounds: PixelRect {
                left,
                top: 0,
                right: left + 2560,
                bottom: 1440,
            },
            work_area: PixelRect {
                left,
                top: 0,
                right: left + 2560,
                bottom: 1400,
            },
            effective_dpi: dpi,
            refresh_rate_hz: Some(144),
        }
    }

    #[test]
    fn edges_become_size_and_dpi_becomes_scale() {
        let d = &map_monitors(vec![raw(r"\\.\DISPLAY1", true, -2560, Some(144))])[0];
        assert_eq!(
            d.bounds,
            Rect {
                x: -2560,
                y: 0,
                width: 2560,
                height: 1440
            }
        );
        assert_eq!(d.work_area.height, 1400);
        assert!((d.dpi_scale - 1.5).abs() < f32::EPSILON);
        assert_eq!(d.label, "Display 1");
        assert_eq!(d.refresh_rate_hz, Some(144));
    }

    #[test]
    fn unknown_dpi_degrades_to_100_percent() {
        let d = &map_monitors(vec![raw(r"\\.\DISPLAY1", true, 0, None)])[0];
        assert!((d.dpi_scale - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn monitors_are_ordered_by_windows_numbering() {
        let out = map_monitors(vec![
            raw(r"\\.\DISPLAY10", false, 5120, Some(96)),
            raw(r"\\.\DISPLAY2", false, 2560, Some(96)),
            raw(r"\\.\DISPLAY1", true, 0, Some(96)),
        ]);
        let labels: Vec<_> = out.iter().map(|d| d.label.as_str()).collect();
        assert_eq!(labels, ["Display 1", "Display 2", "Display 10"]);
    }

    #[test]
    fn names_without_a_number_fall_back_to_enumeration_order() {
        let out = map_monitors(vec![raw("weird", true, 0, Some(96))]);
        assert_eq!(out[0].label, "Display 1");
    }

    #[test]
    fn inverted_rectangles_do_not_underflow() {
        let mut m = raw(r"\\.\DISPLAY1", true, 0, Some(96));
        m.bounds = PixelRect {
            left: 10,
            top: 10,
            right: 0,
            bottom: 0,
        };
        let d = &map_monitors(vec![m])[0];
        assert_eq!((d.bounds.width, d.bounds.height), (0, 0));
    }
}
