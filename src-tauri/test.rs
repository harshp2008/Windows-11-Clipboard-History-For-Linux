use tauri::Manager;
fn test(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        window.with_gtk_window(|gtk_window| {
            //
        });
    }
}
