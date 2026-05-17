# syntax=docker/dockerfile:1.7
ARG RUBY_VERSION=4.0.3

# =============================================================================
# Builder stage: install gems with cache mounts
# =============================================================================
FROM ruby:${RUBY_VERSION}-slim AS builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential libpq-dev git libyaml-dev

WORKDIR /app
COPY Gemfile Gemfile.lock ./

ENV BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3
# TODO: re-enable `bundle config set --local frozen true` once google-protobuf gemspec supports Ruby 4.0
RUN --mount=type=cache,target=/var/cache/bundle,sharing=locked \
    bundle install

# =============================================================================
# Runner stage: runtime image
# =============================================================================
FROM ruby:${RUBY_VERSION}-slim AS runner

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      libpq5 postgresql-client-17

WORKDIR /app
ENV BUNDLE_PATH=/usr/local/bundle
ENV HANAMI_ENV=production
COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY . .

EXPOSE 9001
CMD ["./bin/grpc"]
