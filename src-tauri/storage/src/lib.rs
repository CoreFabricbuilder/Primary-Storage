mod config;
mod error;

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::config::{DATABASE_FILE, SCHEMA_VERSION};
pub use crate::error::AppError;

pub struct ProjectDatabase {
    pub name: String,
    pub path: PathBuf,
    pub schema_version: u32,
}

pub fn open_project(directory: &Path) -> Result<ProjectDatabase, AppError> {
    let directory = directory
        .canonicalize()
        .map_err(|_| AppError::InvalidDirectory)?;
    if !directory.is_dir() {
        return Err(AppError::InvalidDirectory);
    }
    if directory.ancestors().any(is_git_worktree) {
        return Err(AppError::RepositoryDirectory);
    }

    let path = directory.join(DATABASE_FILE);
    if let Ok(metadata) = fs::symlink_metadata(&path) {
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err(AppError::InvalidDatabaseFile);
        }
    }

    let mut connection = Connection::open(&path)?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    connection.pragma_update(None, "journal_mode", "WAL")?;
    let current: u32 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if current > SCHEMA_VERSION {
        return Err(AppError::NewerSchema);
    }
    if current == 0 {
        let transaction = connection.transaction()?;
        transaction.execute_batch(include_str!("../../migrations/001_initial.sql"))?;
        transaction.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        transaction.commit()?;
    }
    let name = directory
        .file_name()
        .and_then(|part| part.to_str())
        .unwrap_or("Project")
        .to_owned();
    Ok(ProjectDatabase {
        name,
        path,
        schema_version: SCHEMA_VERSION,
    })
}

fn is_git_worktree(directory: &Path) -> bool {
    let marker = directory.join(".git");
    marker.is_file() || marker.join("HEAD").is_file()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_and_reopens_a_persistent_database() {
        let directory = tempfile::tempdir().unwrap();
        let first = open_project(directory.path()).unwrap();
        assert_eq!(first.schema_version, 1);
        let connection = Connection::open(&first.path).unwrap();
        connection
            .execute(
                "INSERT INTO programme (id, name) VALUES (?1, ?2)",
                ("00000000-0000-4000-8000-000000000001", "Example programme"),
            )
            .unwrap();
        drop(connection);
        let second = open_project(directory.path()).unwrap();
        let connection = Connection::open(second.path).unwrap();
        let name: String = connection
            .query_row("SELECT name FROM programme", [], |row| row.get(0))
            .unwrap();
        assert_eq!(name, "Example programme");
    }

    #[test]
    fn rejects_git_worktrees() {
        let directory = tempfile::tempdir().unwrap();
        fs::create_dir(directory.path().join(".git")).unwrap();
        fs::write(directory.path().join(".git/HEAD"), "ref: refs/heads/main\n").unwrap();
        let nested = directory.path().join("project");
        fs::create_dir(&nested).unwrap();
        assert!(matches!(
            open_project(&nested),
            Err(AppError::RepositoryDirectory)
        ));
    }

    #[test]
    fn rejects_a_database_symlink() {
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("target.sqlite3");
        fs::write(&target, "").unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&target, directory.path().join(DATABASE_FILE)).unwrap();
            assert!(matches!(
                open_project(directory.path()),
                Err(AppError::InvalidDatabaseFile)
            ));
        }
    }

    #[test]
    fn rejects_unrecognised_fact_classification() {
        let directory = tempfile::tempdir().unwrap();
        let project = open_project(directory.path()).unwrap();
        let connection = Connection::open(project.path).unwrap();
        connection
            .execute(
                "INSERT INTO programme (id, name) VALUES (?1, ?2)",
                ("00000000-0000-4000-8000-000000000001", "Example programme"),
            )
            .unwrap();
        let result = connection.execute(
            "INSERT INTO architecture_fact (id, programme_id, subject_kind, subject_id, fact_key, fact_value, time_horizon, perspective, classification) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            (
                "00000000-0000-4000-8000-000000000002",
                "00000000-0000-4000-8000-000000000001",
                "site",
                "00000000-0000-4000-8000-000000000003",
                "wan",
                "example.invalid",
                "Future State",
                "Design Intent",
                "Auto Confirmed",
            ),
        );
        assert!(result.is_err());
    }
}
