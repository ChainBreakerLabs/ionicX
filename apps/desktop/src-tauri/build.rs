use std::{env, fs, path::PathBuf};

fn main() {
    sync_sidecar();
    tauri_build::build()
}

fn sync_sidecar() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap_or_default());
    if manifest_dir.as_os_str().is_empty() {
        return;
    }

    let target = env::var("TARGET").unwrap_or_default();
    if target.is_empty() {
        return;
    }

    let exe_ext = if target.contains("windows") { ".exe" } else { "" };
    let target_name = format!("ionicx-api-{target}{exe_ext}");
    let generic_name = format!("ionicx-api{exe_ext}");

    let bin_dir = manifest_dir.join("bin");
    let src_target = bin_dir.join(&target_name);
    let dst_target = manifest_dir.join(&target_name);
    if src_target.exists() {
        let _ = fs::copy(&src_target, &dst_target);
    } else {
        println!(
            "cargo:warning=sidecar missing at {}, expected after backend build",
            src_target.display()
        );
    }

    let src_generic = bin_dir.join(&generic_name);
    let dst_generic = manifest_dir.join(&generic_name);
    if src_generic.exists() {
        let _ = fs::copy(&src_generic, &dst_generic);
    }
}
