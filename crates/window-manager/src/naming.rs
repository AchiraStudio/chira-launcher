/// Packaged (UWP) apps are all hosted by this process, so its name says nothing about the app.
const UWP_HOST: &str = "ApplicationFrameHost";

/// A friendly application name: the executable's stem prettified (`code.exe` → "Code",
/// `visual-studio.exe` → "Visual Studio"), or the window title for UWP-hosted apps and when
/// the executable is unknown (for example an elevated process).
pub fn app_name(exe_name: Option<&str>, title: &str) -> String {
    let Some(exe) = exe_name else {
        return title.trim().to_owned();
    };
    let stem = exe.rsplit_once('.').map_or(exe, |(stem, _)| stem);
    if stem.eq_ignore_ascii_case(UWP_HOST) || stem.is_empty() {
        return title.trim().to_owned();
    }
    prettify(stem)
}

fn prettify(stem: &str) -> String {
    // `-`/`_` become spaces, and a lower→UPPER boundary splits camel case
    // (`WindowsTerminal` → "Windows Terminal"). Runs of capitals (`VSCode`) are left intact.
    let mut spaced = String::with_capacity(stem.len() + 4);
    let mut previous: Option<char> = None;
    for c in stem.chars() {
        if c == '-' || c == '_' {
            spaced.push(' ');
        } else {
            if c.is_uppercase() && previous.is_some_and(char::is_lowercase) {
                spaced.push(' ');
            }
            spaced.push(c);
        }
        previous = Some(c);
    }
    spaced
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().chain(chars).collect::<String>(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::app_name;

    #[test]
    fn prettifies_executable_names() {
        assert_eq!(app_name(Some("notepad.exe"), "x"), "Notepad");
        assert_eq!(app_name(Some("visual-studio.exe"), "x"), "Visual Studio");
        assert_eq!(app_name(Some("Code.exe"), "x"), "Code");
        assert_eq!(app_name(Some("my_game.exe"), "x"), "My Game");
    }

    #[test]
    fn splits_camel_case_but_keeps_acronyms() {
        assert_eq!(
            app_name(Some("WindowsTerminal.exe"), "x"),
            "Windows Terminal"
        );
        assert_eq!(app_name(Some("VSCode.exe"), "x"), "VSCode");
        assert_eq!(app_name(Some("chrome.exe"), "x"), "Chrome");
    }

    #[test]
    fn uwp_hosted_apps_use_their_title() {
        assert_eq!(
            app_name(Some("ApplicationFrameHost.exe"), " Calculator "),
            "Calculator"
        );
    }

    #[test]
    fn unknown_executables_fall_back_to_the_title() {
        assert_eq!(app_name(None, "Elevated Tool"), "Elevated Tool");
    }
}
