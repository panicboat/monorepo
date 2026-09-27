use serde::Serialize;
use topcoat::Result;
use topcoat::asset::asset_config;
use topcoat::context::{Cx, app_context};
use topcoat::router::content::Json;
use topcoat::router::error::too_many_requests;
use topcoat::router::request::client_ip;
use topcoat::router::{page, path_param, route};
use topcoat::view::{View, view};

pub use crate::room::RoomId;
use crate::room::RoomRegistry;

fn import_map_json(
    microphone_url: &str,
    pcm_resample_url: &str,
    audio_worklet_url: &str,
) -> String {
    serde_json::json!({
        "imports": {
            "./microphone.js": microphone_url,
            "./pcm-resample.js": pcm_resample_url,
            "./audio-worklet-processor.js": audio_worklet_url,
        }
    })
    .to_string()
}

#[page("/translate/")]
pub async fn creation_form() -> Result<impl View> {
    Ok(view! {
        <!DOCTYPE html>
        <html>
            <head>
                <title>"Meeting Translation"</title>
                <link rel="stylesheet" href=(crate::assets::STYLES_CSS)>
                topcoat::dev::script()
            </head>
            <body>
                <h1>"Meeting Translation"</h1>
                <form id="create-room-form">
                    <label>
                        "Display name"
                        <input type="text" id="creation-display-name" maxlength="40" required="">
                    </label>
                    <label>
                        "Spoken language"
                        <select id="creation-speech-language">
                            <option value="japanese">"Japanese"</option>
                            <option value="english">"English"</option>
                        </select>
                    </label>
                    <label>
                        "Display language"
                        <select id="creation-display-language">
                            <option value="japanese">"Japanese"</option>
                            <option value="english">"English"</option>
                        </select>
                    </label>
                    <label>
                        <input type="checkbox" id="creation-consent" required="">
                        "I consent to sending audio and captions to Amazon Transcribe and Amazon Bedrock for transcription and translation."
                    </label>
                    <button type="submit">"Create meeting"</button>
                </form>
                <script src=(crate::assets::CREATION_FORM_JS)></script>
            </body>
        </html>
    })
}

#[derive(Serialize)]
pub struct CreateRoomResponse {
    room_id: String,
    join_token: String,
}

#[route(POST "/translate/api/rooms")]
pub async fn create_room(cx: &Cx) -> Result<Json<CreateRoomResponse>> {
    let registry = app_context::<std::sync::Arc<RoomRegistry>>(cx).clone();
    let ip = client_ip(cx).ok_or_else(|| too_many_requests(600))?;
    if !registry.allow_creation(ip) {
        return Err(too_many_requests(600).into());
    }

    let (room_id, join_token) = registry.create();
    Ok(Json(CreateRoomResponse {
        room_id,
        join_token,
    }))
}

#[route(GET "/translate/healthz")]
pub async fn healthz() -> Result<&'static str> {
    Ok("ok")
}

#[page("/translate/rooms/{room_id}")]
pub async fn meeting_page(cx: &Cx) -> Result<impl View> {
    let room_id = path_param::<RoomId>(cx)?.clone();
    let assets = asset_config(cx);
    let import_map = import_map_json(
        &assets.resolve(crate::assets::MICROPHONE_JS),
        &assets.resolve(crate::assets::PCM_RESAMPLE_JS),
        &assets.resolve(crate::assets::AUDIO_WORKLET_PROCESSOR_JS),
    );

    Ok(view! {
        <!DOCTYPE html>
        <html>
            <head>
                <title>"Meeting Translation"</title>
                <link rel="stylesheet" href=(crate::assets::STYLES_CSS)>
                topcoat::dev::script()
                <script type="importmap">(import_map)</script>
            </head>
            <body>
                <div id="app" data-room-id=(room_id)></div>
                <script type="module" src=(crate::assets::SESSION_JS)></script>
            </body>
        </html>
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn import_map_json_maps_each_relative_specifier_to_its_url() {
        let json = import_map_json("/a-1.js", "/b-2.js", "/c-3.js");
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["imports"]["./microphone.js"], "/a-1.js");
        assert_eq!(parsed["imports"]["./pcm-resample.js"], "/b-2.js");
        assert_eq!(
            parsed["imports"]["./audio-worklet-processor.js"],
            "/c-3.js"
        );
    }
}
