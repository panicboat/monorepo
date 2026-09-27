pub mod actor;
pub mod registry;

pub use actor::{Connection, JoinOutcome, RoomCommand, spawn_room};
pub use registry::RoomRegistry;

topcoat::router::path_param!(pub room_id: String, error = bad_request);
