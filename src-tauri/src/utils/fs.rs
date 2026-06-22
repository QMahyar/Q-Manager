//! File system utilities for Q Manager

use std::fs;
use std::io;
use std::path::Path;

/// Recursively copy a directory and its contents.
///
/// This is used as a fallback when `rename` fails across filesystems.
/// Skips symlinks to avoid following potentially unsafe links.
pub fn copy_dir_recursive(src: &Path, dst: &Path) -> io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;

        // Get the metadata for the entry itself (doesn't follow symlinks)
        let metadata = entry.metadata()?;
        let from_path = entry.path();
        let to_path = dst.join(entry.file_name());

        // Skip symlinks to avoid following malicious links
        if metadata.is_symlink() {
            continue;
        }

        if metadata.is_dir() {
            copy_dir_recursive(&from_path, &to_path)?;
        } else if metadata.is_file() {
            if let Some(parent) = to_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&from_path, &to_path)?;
        }
    }

    Ok(())
}

/// Get the sessions directory path (relative to the executable)
pub fn get_sessions_dir() -> std::path::PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    exe_dir.join("sessions")
}
