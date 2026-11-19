// Release builds are a GUI app: no console window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    chira_launcher_lib::run();
}
