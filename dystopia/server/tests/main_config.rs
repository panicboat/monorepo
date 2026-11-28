mod support;

use std::net::TcpListener;
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

#[test]
fn reports_a_bind_failure_without_announcing_that_it_serves() {
    let taken = TcpListener::bind("127.0.0.1:0").unwrap();
    let output = server()
        .env("DATABASE_URL", support::database_url())
        .env(
            "SERVER_BIND_ADDRESS",
            taken.local_addr().unwrap().to_string(),
        )
        .output()
        .unwrap();

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(!output.status.success(), "{stderr}");
    assert!(!stderr.contains("serving on"), "{stderr}");
    assert!(stderr.contains("failed to bind"), "{stderr}");
}
