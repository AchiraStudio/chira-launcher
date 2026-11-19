use desktop_core::{EngineError, EngineResult};

/// Accepts exactly `#RRGGBB` (case-insensitive) and returns it upper-cased.
///
/// Strictness is deliberate: the value ends up in a CSS custom property in the shell, so only a
/// plain hex colour may pass.
pub fn normalize_accent(input: &str) -> EngineResult<String> {
    let trimmed = input.trim();
    let valid = trimmed.len() == 7
        && trimmed.starts_with('#')
        && trimmed[1..].bytes().all(|b| b.is_ascii_hexdigit());
    if valid {
        Ok(trimmed.to_ascii_uppercase())
    } else {
        Err(EngineError::InvalidInput(format!(
            "accent colour must look like #RRGGBB, got `{}`",
            input.chars().take(24).collect::<String>()
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_accent;

    #[test]
    fn accepts_and_normalises_hex_colours() {
        assert_eq!(normalize_accent("#3979b9").unwrap(), "#3979B9");
        assert_eq!(normalize_accent("  #AABBCC ").unwrap(), "#AABBCC");
    }

    #[test]
    fn rejects_everything_else() {
        for bad in [
            "",
            "#fff",
            "3979B9",
            "#3979B9FF",
            "#GGGGGG",
            "red",
            "url(x)",
            "#12345é",
        ] {
            assert!(normalize_accent(bad).is_err(), "{bad:?} should be rejected");
        }
    }
}
