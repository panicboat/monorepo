# Tasks: Identity Slice

- [ ] Define Proto <!-- id: 1 -->
    - Add `Register` and `Login` RPCs to `proto/identity/v1/service.proto`.
    - Run `buf generate` & `grpc_tools_ruby_protoc`.

- [ ] Database Setup <!-- id: 2 -->
    - Create `users` migration.
    - Run migration.

- [ ] Implement Repository <!-- id: 3 -->
    - Create `Identity::Repositories::UserRepository`.
    - Implement `create`, `find_by_email`.

- [ ] Implement UseCase/Action <!-- id: 4 -->
    - Implement Application Logic (Hashing, JWT).

- [ ] Implement gRPC Handler <!-- id: 5 -->
    - Create `Identity::Grpc::Handler`.
    - Map RPCs to Actions.
