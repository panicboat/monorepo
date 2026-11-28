use std::process::ExitCode;
use std::sync::Arc;

use dystopia_server::config::{Config, StorageKind};
use dystopia_server::media::service::MediaHandler;
use dystopia_server::media::storage::{LocalStorage, S3Storage, Storage};
use dystopia_server::stub::media::v1::media_service_server::MediaServiceServer;
use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tonic::transport::Server;
use tonic::transport::server::TcpIncoming;

#[tokio::main]
async fn main() -> ExitCode {
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}

// Errors carry no Config: its Debug output contains DATABASE_URL with the password.
async fn run() -> Result<(), String> {
    let config = Config::from_vars(|key| std::env::var(key).ok())
        .map_err(|error| format!("invalid configuration: {error}"))?;
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&config.database_url)
        .await
        .map_err(|error| format!("failed to connect to the database: {error}"))?;
    let storage: Arc<dyn Storage> = match config.storage {
        StorageKind::Local => Arc::new(LocalStorage {
            app_url: config.app_url,
            uploads_dir: config.local_uploads_dir,
        }),
        StorageKind::S3 => {
            let bucket = config
                .media_bucket_name
                .ok_or("invalid configuration: MEDIA_BUCKET_NAME is required")?;
            Arc::new(S3Storage::new(bucket, config.media_bucket_region).await)
        }
    };

    // Not Server::serve: it binds inside its future, so a taken port would be reported after "serving on".
    let listener = TcpListener::bind(config.bind_address)
        .await
        .map_err(|error| format!("failed to bind {}: {error}", config.bind_address))?;
    eprintln!("serving on {}", config.bind_address);
    Server::builder()
        .add_service(MediaServiceServer::new(MediaHandler::new(pool, storage)))
        .serve_with_incoming(incoming(listener))
        .await
        .map_err(|error| format!("server failed: {error}"))
}

// From<TcpListener> leaves TCP_NODELAY unset, which Server::serve would set; keepalive stays off in both.
fn incoming(listener: TcpListener) -> TcpIncoming {
    TcpIncoming::from(listener).with_nodelay(Some(true))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tonic::codegen::tokio_stream::StreamExt;

    #[tokio::test]
    async fn accepted_connections_have_tcp_nodelay() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let mut incoming = incoming(listener);
        let _client = std::net::TcpStream::connect(address).unwrap();

        let accepted = incoming.next().await.unwrap().unwrap();

        assert!(accepted.nodelay().unwrap());
    }
}
