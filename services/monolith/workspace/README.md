# Monolith (🌸Hanami + gRPC)

Modules:
- **Identity Slice**: Authentication (Register, Login) via gRPC.

## Requirements
- Ruby 3.4+
- PostgreSQL
- Buf (for proto generation)

## Setup

### 1. Install Dependencies
```bash
bundle install
```

### 2. Database Setup
```bash
# Update config/app.rb or .env to point to your Postgres
# Default: postgres

bundle exec hanami db create
bundle exec hanami db migrate
```

## Running Locally

### Option A: Local Ruby
```bash
# Database listening on 0.0.0.0:5432
docker-compose up -d db
# gRPC server listening on 0.0.0.0:9001
./bin/grpc
```

### Option B: Docker Compose
```bash
docker-compose up --build
```

## Proto Generation
If you modify `proto/identity/v1/service.proto` from the root:
```bash
# From services/monolith directory
bundle exec grpc_tools_ruby_protoc -I ../../proto --ruby_out=lib --grpc_out=lib ../../proto/identity/v1/service.proto
```

## Testing

### Automated Specs
```bash
# From services/monolith directory
bundle exec rspec
```

## Useful links

- [Hanami](http://hanamirb.org)
- [Hanami guides](https://guides.hanamirb.org/)
