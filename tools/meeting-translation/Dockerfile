FROM rust:1-bookworm AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY assets ./assets
RUN cargo install topcoat-cli
RUN cargo build --release
RUN topcoat asset bundle --release

FROM debian:bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 meeting-translation \
  && adduser --system --uid 1001 --ingroup meeting-translation meeting-translation

ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder --chown=meeting-translation:meeting-translation /app/target/release/meeting-translation ./meeting-translation
COPY --from=builder --chown=meeting-translation:meeting-translation /app/target/release/assets ./assets

USER meeting-translation
EXPOSE 3000

CMD ["./meeting-translation"]
