fn main() {
    // Embed our own manifest (per-monitor-v2 DPI awareness, asInvoker). See windows-app.manifest.
    println!("cargo:rerun-if-changed=windows-app.manifest");

    let windows =
        tauri_build::WindowsAttributes::new().app_manifest(include_str!("windows-app.manifest"));
    let attributes = tauri_build::Attributes::new().windows_attributes(windows);

    if let Err(err) = tauri_build::try_build(attributes) {
        eprintln!("tauri build script failed: {err:#}");
        std::process::exit(1);
    }
}
