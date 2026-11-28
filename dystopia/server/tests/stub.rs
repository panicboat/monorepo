use dystopia_server::stub::media::v1::media_service_server::{MediaService, MediaServiceServer};
use dystopia_server::stub::media::v1::{MediaType, RegisterMediaRequest};
use prost::Message;

fn _serve<T: MediaService>(service: T) -> MediaServiceServer<T> {
    MediaServiceServer::new(service)
}

#[test]
fn media_messages_round_trip_through_protobuf() {
    let request = RegisterMediaRequest {
        media_id: "id".to_string(),
        media_key: "key".to_string(),
        media_type: MediaType::Video as i32,
        filename: "a.mp4".to_string(),
        content_type: "video/mp4".to_string(),
        size_bytes: 42,
        thumbnail_key: "thumb".to_string(),
    };

    let decoded = RegisterMediaRequest::decode(request.encode_to_vec().as_slice()).unwrap();

    assert_eq!(decoded, request);
}
