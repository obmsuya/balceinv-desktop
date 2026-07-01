use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let shell = app.shell();
            let sidecar_command = shell.sidecar("backend").expect("backend sidecar not found");
            tauri::async_runtime::spawn(async move {
                let (_receiver, _child) = sidecar_command
                    .spawn()
                    .expect("failed to spawn backend sidecar");
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}