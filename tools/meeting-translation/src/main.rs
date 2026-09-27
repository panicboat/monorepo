use std::sync::Arc;

use topcoat::asset::{AssetBundle, RouterBuilderAssetExt};
use topcoat::router::Router;

use meeting_translation::adapters::bedrock::BedrockTranslator;
use meeting_translation::adapters::transcribe::TranscribeRecognizer;
use meeting_translation::room::RoomRegistry;
use meeting_translation::{config, pages, session};

#[tokio::main]
async fn main() {
    let config = config::load().expect("invalid configuration");

    let aws_config = aws_config::from_env()
        .region(aws_config::Region::new(config.aws_region.clone()))
        .load()
        .await;
    let translator = Arc::new(BedrockTranslator::new(
        aws_sdk_bedrockruntime::Client::new(&aws_config),
        config.bedrock_model_id,
    ));
    let recognizer = Arc::new(TranscribeRecognizer::new(
        aws_sdk_transcribestreaming::Client::new(&aws_config),
    ));
    let registry = RoomRegistry::new(translator, recognizer, config.glossary);
    tokio::spawn(registry.clone().run_lifecycle_loop());

    let router = Router::builder()
        .page(pages::creation_form)
        .route(pages::create_room)
        .page(pages::meeting_page)
        .route(session::session)
        .route(pages::healthz)
        .assets(AssetBundle::load().unwrap())
        .app_context(registry)
        .build();

    topcoat::start(router).await.unwrap();
}
