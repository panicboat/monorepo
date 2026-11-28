use std::process::ExitCode;

use dystopia_server::config::Config;

fn main() -> ExitCode {
    // TODO: serve MediaService on `config.bind_address`; tonic cannot serve a Router with no service.
    match Config::from_vars(|key| std::env::var(key).ok()) {
        Ok(_config) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("invalid configuration: {error}");
            ExitCode::FAILURE
        }
    }
}
