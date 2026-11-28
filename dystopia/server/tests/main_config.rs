use std::process::Command;

fn server() -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_dystopia-server"));
    command.env_remove("DATABASE_URL");
    command
}

#[test]
fn exits_with_the_config_error_when_the_database_url_is_missing() {
    let output = server().output().unwrap();

    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("DATABASE_URL is required"));
}
