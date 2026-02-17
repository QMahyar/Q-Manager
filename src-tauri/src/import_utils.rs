use std::collections::BTreeSet;
use std::path::PathBuf;

use crate::commands::{error_response, CommandResult};

const ZIP_SUBDIR_SEPARATOR: &str = "::";

/// Expand import candidates. If any candidate is a ZIP archive that contains multiple
/// account session folders, this expands to one candidate per account.
///
/// Supported ZIP layout (exported by accounts export):
/// - {account_name}_session/**
/// - account_{id}/** (legacy)
pub fn expand_import_candidates(
    candidates: Vec<crate::commands::ImportCandidate>,
) -> CommandResult<Vec<crate::commands::ImportCandidate>> {
    let mut expanded = Vec::new();

    for candidate in candidates {
        let source = PathBuf::from(&candidate.source_path);
        let is_zip = source.is_file() && source.extension().map(|e| e == "zip").unwrap_or(false);

        if !is_zip {
            expanded.push(candidate);
            continue;
        }

        let file = std::fs::File::open(&source).map_err(error_response)?;
        let mut archive = zip::ZipArchive::new(file).map_err(error_response)?;

        let mut session_dirs = BTreeSet::new();
        for i in 0..archive.len() {
            let file = archive.by_index(i).map_err(error_response)?;
            let path = match file.enclosed_name() {
                Some(path) => path.to_path_buf(),
                None => continue,
            };

            if let Some(root) = path.components().next() {
                let root_str = root.as_os_str().to_string_lossy().to_string();
                if root_str.ends_with("_session") || root_str.starts_with("account_") {
                    session_dirs.insert(root_str);
                }
            }
        }

        if session_dirs.len() <= 1 {
            expanded.push(candidate);
            continue;
        }

        for dir in session_dirs {
            let account_name = dir
                .strip_suffix("_session")
                .unwrap_or(&dir)
                .replace('_', " ")
                .trim()
                .to_string();
            expanded.push(crate::commands::ImportCandidate {
                source_path: format!("{}{}{}", candidate.source_path, ZIP_SUBDIR_SEPARATOR, dir),
                account_name: if account_name.is_empty() {
                    candidate.account_name.clone()
                } else {
                    account_name
                },
            });
        }
    }

    Ok(expanded)
}

/// Split a source path that optionally includes a ZIP subdirectory suffix.
///
/// Example: path/to/accounts.zip::Player_session -> (path/to/accounts.zip, Some("Player_session"))
pub fn split_zip_source(source: &str) -> (PathBuf, Option<PathBuf>) {
    if let Some((zip_path, subdir)) = source.split_once(ZIP_SUBDIR_SEPARATOR) {
        let trimmed = subdir.trim().trim_matches(|c| c == '/' || c == '\\');
        if trimmed.is_empty() {
            return (PathBuf::from(zip_path), None);
        }
        return (PathBuf::from(zip_path), Some(PathBuf::from(trimmed)));
    }

    (PathBuf::from(source), None)
}

#[cfg(test)]
mod tests {
    use super::split_zip_source;

    #[test]
    fn split_zip_source_without_subdir() {
        let (path, subdir) = split_zip_source("C:/sessions/accounts.zip");
        assert_eq!(path.to_string_lossy(), "C:/sessions/accounts.zip");
        assert!(subdir.is_none());
    }

    #[test]
    fn split_zip_source_with_subdir() {
        let (path, subdir) = split_zip_source("C:/sessions/accounts.zip::Test_session");
        assert_eq!(path.to_string_lossy(), "C:/sessions/accounts.zip");
        assert_eq!(subdir.unwrap().to_string_lossy(), "Test_session");
    }
}
