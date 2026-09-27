use serde::Serialize;
use topcoat::Result;
use topcoat::context::{Cx, app_context};
use topcoat::router::content::Json;
use topcoat::router::error::too_many_requests;
use topcoat::router::request::client_ip;
use topcoat::router::{page, path_param, route};
use topcoat::view::{View, view};

pub use crate::room::RoomId;
use crate::room::RoomRegistry;

#[page("/translate/")]
pub async fn creation_form() -> Result<impl View> {
    Ok(view! {
        <!DOCTYPE html>
        <html>
            <head>
                <title>"Meeting Translation"</title>
                topcoat::dev::script()
            </head>
            <body>
                <h1>"Meeting Translation"</h1>
                <form id="create-room-form">
                    <label>
                        "Display name"
                        <input type="text" id="display-name" maxlength="40" required="">
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

#[page("/translate/rooms/{room_id}")]
pub async fn meeting_page(cx: &Cx) -> Result<impl View> {
    let room_id = path_param::<RoomId>(cx)?.clone();

    Ok(view! {
        <!DOCTYPE html>
        <html>
            <head>
                <title>"Meeting Translation"</title>
                topcoat::dev::script()
            </head>
            <body>
                <div id="app" data-room-id=(room_id)></div>
                <script type="module" src=(crate::assets::SESSION_JS)></script>
            </body>
        </html>
    })
}
