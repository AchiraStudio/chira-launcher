/// Shows a modal error box. Used only when the app cannot start at all — a release build has no
/// console, so without this a startup failure would be a silent exit.
///
/// Returns nothing: there is no useful recovery if the message box itself cannot be shown.
pub fn show_fatal_error(title: &str, message: &str) {
    imp::show_fatal_error(title, message);
}

#[cfg(windows)]
mod imp {
    use windows::Win32::UI::WindowsAndMessaging::{MB_ICONERROR, MB_OK, MessageBoxW};
    use windows::core::PCWSTR;

    pub fn show_fatal_error(title: &str, message: &str) {
        let title: Vec<u16> = title.encode_utf16().chain(Some(0)).collect();
        let message: Vec<u16> = message.encode_utf16().chain(Some(0)).collect();
        // SAFETY: both buffers are NUL-terminated UTF-16 and outlive the (blocking) call; a null
        // owner window is explicitly allowed.
        unsafe {
            MessageBoxW(
                None,
                PCWSTR(message.as_ptr()),
                PCWSTR(title.as_ptr()),
                MB_OK | MB_ICONERROR,
            );
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn show_fatal_error(title: &str, message: &str) {
        eprintln!("{title}: {message}");
    }
}
