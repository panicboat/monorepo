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
To update Ruby code from Proto definitions (`proto/**/*.proto`):

```bash
bin/codegen
# Note: Automatically scans all .proto files in root 'proto' dir
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
