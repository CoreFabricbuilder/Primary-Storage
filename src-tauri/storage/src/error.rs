use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Choose a project directory outside a Git repository")]
    RepositoryDirectory,
    #[error("The selected project directory is unavailable")]
    InvalidDirectory,
    #[error("The project database path is not a regular file")]
    InvalidDatabaseFile,
    #[error("The project database could not be opened")]
    Database(#[from] rusqlite::Error),
    #[error("The project database uses a newer schema")]
    NewerSchema,
}
