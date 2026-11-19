use platform_windows::RawWindow;

/// Window classes owned by the Windows shell itself (desktop, taskbar, input surfaces). They are
/// visible and titled but are not applications the user switches between (plan §5.2 filtering).
const SHELL_CLASSES: &[&str] = &[
    "Progman",
    "WorkerW",
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
    "Windows.UI.Core.CoreWindow",
    "XamlExplorerHostIslandWindow",
    "Shell_InputSwitchTopLevelWindow",
];

/// Whether `window` is a real top-level application window worth showing to the user.
///
/// Excluded: invisible, untitled, cloaked (suspended UWP / other virtual desktop), tool windows,
/// owned popups/dialogs (they belong to their owner's window), zero-size windows, Windows shell
/// windows, and the shell's own windows.
pub fn is_application_window(window: &RawWindow, own_pid: u32) -> bool {
    window.is_visible
        && !window.title.trim().is_empty()
        && !window.is_cloaked
        && !window.is_tool_window
        && !window.has_owner
        && window.pid != own_pid
        && window.rect.right > window.rect.left
        && window.rect.bottom > window.rect.top
        && !SHELL_CLASSES.contains(&window.class_name.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::raw;

    const OWN: u32 = 999;

    fn base() -> RawWindow {
        raw(1, 100, "Notepad", Some(r"C:\Windows\notepad.exe"))
    }

    #[test]
    fn a_normal_window_passes() {
        assert!(is_application_window(&base(), OWN));
    }

    #[test]
    fn each_exclusion_rule_is_enforced() {
        type Mutation = Box<dyn Fn(&mut RawWindow)>;
        let cases: Vec<(&str, Mutation)> = vec![
            ("invisible", Box::new(|w| w.is_visible = false)),
            ("untitled", Box::new(|w| w.title = "  ".into())),
            ("cloaked", Box::new(|w| w.is_cloaked = true)),
            ("tool window", Box::new(|w| w.is_tool_window = true)),
            ("owned popup", Box::new(|w| w.has_owner = true)),
            ("own process", Box::new(|w| w.pid = OWN)),
            ("zero width", Box::new(|w| w.rect.right = w.rect.left)),
            ("zero height", Box::new(|w| w.rect.bottom = w.rect.top)),
            (
                "taskbar",
                Box::new(|w| w.class_name = "Shell_TrayWnd".into()),
            ),
            ("desktop", Box::new(|w| w.class_name = "Progman".into())),
        ];
        for (name, mutate) in cases {
            let mut w = base();
            mutate(&mut w);
            assert!(!is_application_window(&w, OWN), "{name} should be excluded");
        }
    }

    #[test]
    fn minimized_windows_are_still_applications() {
        let mut w = base();
        w.is_minimized = true;
        assert!(is_application_window(&w, OWN));
    }
}
