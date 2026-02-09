//! File system utilities for Q Manager

use std::fs;
use std::io;
use std::path::Path;

/// Recursively copy a directory and its contents.
///
/// This is used as a fallback when `rename` fails across filesystems.
pub fn copy_dir_recursive(src: &Path, dst: &Path) -> io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let from_path = entry.path();
        let to_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&from_path, &to_path)?;
        } else if file_type.is_file() {
            if let Some(parent) = to_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&from_path, &to_path)?;
        }
    }

    Ok(())
}
