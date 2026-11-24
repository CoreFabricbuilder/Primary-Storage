use serde::Serialize;
use tracing::{error, info};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectInfo {
    name: String,
    schema_version: u32,
}

#[tauri::command]
fn select_project() -> Result<Option<ProjectInfo>, String> {
    let Some(directory) = rfd::FileDialog::new()
        .set_title("Choose Network Refresh project folder")
        .pick_folder()
    else {
        return Ok(None);
    };

    match cockpit_storage::open_project(&directory) {
        Ok(project) => {
            info!(
                schema_version = project.schema_version,
                "project database ready"
            );
            Ok(Some(ProjectInfo {
                name: project.name,
                schema_version: project.schema_version,
            }))
        }
        Err(problem) => {
            error!(error = %problem, "project open failed");
            Err(problem.to_string())
        }
    }
}

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .json()
        .with_target(false)
        .init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![select_project])
        .setup(|_| {
            info!(
                app_version = env!("CARGO_PKG_VERSION"),
                "application started"
            );
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Network Refresh Architecture Cockpit");
}
