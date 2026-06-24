// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(all(not(debug_assertions), feature = "desktop"), windows_subsystem = "windows")]

#[allow(unreachable_code, unused_variables)]
fn main() {
    let args: Vec<String> = std::env::args().collect();
    let want_serve = args.get(1).map(|a| a == "serve").unwrap_or(false);

    // Desktop build: default to the native window; `serve` falls through to the
    // server below (if compiled in).
    #[cfg(feature = "desktop")]
    if !want_serve {
        q_manager_lib::run();
        return;
    }

    // Server build (or `serve` requested on a build that has the server feature).
    #[cfg(feature = "server")]
    {
        q_manager_lib::run_server(&args);
        return;
    }

    let _ = want_serve;
    eprintln!(
        "This build cannot run in the requested mode.\n\
         - Desktop window:  build with the default features.\n\
         - Headless server: build with `--features server` and run `q-manager serve`."
    );
    std::process::exit(1);
}
