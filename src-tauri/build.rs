use std::path::PathBuf;

fn main() {
    tauri_build::build();

    // Copy Telethon worker to target directory for development
    copy_telethon_worker();
    // Ensure WebView2Loader.dll is available for test binaries on Windows
    copy_webview2_loader();
}

fn copy_telethon_worker() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let target_dir = manifest_dir.join("target");

    #[cfg(windows)]
    let worker_name = "telethon-worker.exe";
    #[cfg(not(windows))]
    let worker_name = "telethon-worker";

    let source = manifest_dir
        .parent()
        .unwrap()
        .join("telethon-worker")
        .join("dist")
        .join(worker_name);

    if !source.exists() {
        println!(
            "cargo:warning=Telethon worker not found at {:?}. Run build-telethon script first.",
            source
        );
        return;
    }

    // Copy to both debug and release directories
    for profile in &["debug", "release"] {
        let dest = target_dir.join(profile).join(worker_name);

        if let Some(parent) = dest.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        match std::fs::copy(&source, &dest) {
            Ok(_) => println!("cargo:warning=Copied Telethon worker to {:?}", dest),
            Err(e) => println!(
                "cargo:warning=Failed to copy Telethon worker to {:?}: {}",
                dest, e
            ),
        }
    }

    // Re-run if the worker changes
    println!("cargo:rerun-if-changed={}", source.display());
}

fn copy_webview2_loader() {
    #[cfg(windows)]
    {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let target_dir = manifest_dir.join("target");
        let build_dir = target_dir.join("debug").join("build");

        if let Ok(entries) = std::fs::read_dir(&build_dir) {
            for entry in entries.flatten() {
                let path = entry
                    .path()
                    .join("out")
                    .join("x64")
                    .join("WebView2Loader.dll");
                if path.exists() {
                    for profile in &["debug", "release"] {
                        let dest = target_dir.join(profile).join("WebView2Loader.dll");
                        if let Some(parent) = dest.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                        let _ = std::fs::copy(&path, &dest);

                        let deps_dest = target_dir
                            .join(profile)
                            .join("deps")
                            .join("WebView2Loader.dll");
                        if let Some(parent) = deps_dest.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                        let _ = std::fs::copy(&path, &deps_dest);
                    }
                    println!("cargo:warning=Copied WebView2Loader.dll to target directories");
                    println!("cargo:rerun-if-changed={}", path.display());
                    return;
                }
            }
        }
    }
}
