use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Holds the running sidecar's handle for the app's lifetime so it can be
/// killed on exit. Without this, closing/restarting the app leaves the Go
/// backend running as an orphan still bound to its port, and the next
/// launch's sidecar fails to bind and exits immediately.
struct SidecarHandle(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_stronghold::Builder::new(|password| {
            let mut hasher = Sha256::new();
            hasher.update(password.as_bytes());
            hasher.finalize().to_vec()
        }).build())
        // Logging is needed in release builds too, not just debug — a sidecar
        // that fails to start or crashes right after starting produces no
        // visible error otherwise; it was previously silent in every
        // installed build.
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            let shell = app.shell();
            let sidecar_command = shell.sidecar("backend").expect("backend sidecar not found");

            let (mut receiver, child) = sidecar_command
                .spawn()
                .expect("failed to spawn backend sidecar");

            app.manage(SidecarHandle(Mutex::new(Some(child))));

            tauri::async_runtime::spawn(async move {
                while let Some(event) = receiver.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            log::info!("[backend] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            log::error!("[backend] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Error(err) => {
                            log::error!("[backend] sidecar error: {err}");
                        }
                        CommandEvent::Terminated(payload) => {
                            log::error!(
                                "[backend] sidecar exited unexpectedly, code: {:?}",
                                payload.code
                            );
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<SidecarHandle>() {
                    if let Some(child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
