FROM node:26.13.1-slim AS frontend-builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
# Install corepack from npm because Node.js stopped bundling it in v25.
RUN npm install -g corepack@0.36.0 && \
    corepack enable && \
    apt-get update -qq && \
    apt-get install -y --no-install-recommends git ca-certificates

WORKDIR /app
COPY frontend/ .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM ruby:4.0.10-slim AS monolith-builder
# libssl-dev lets bundler build the openssl gem when the lockfile pins a version this Ruby does not bundle.
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends build-essential libpq-dev git libyaml-dev libssl-dev

WORKDIR /app
COPY monolith/Gemfile monolith/Gemfile.lock ./
ENV BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3
RUN bundle config set --local frozen true && \
    bundle install

# Match the Debian release of the runner's ruby:4.0.10-slim so the binary links against the same glibc.
FROM rust:1.100.0-slim-trixie AS server-builder
WORKDIR /app/server
COPY server/ .
RUN cargo build --release --locked

FROM ruby:4.0.10-slim AS runner
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends libpq5 postgresql-client-17 libstdc++6 libatomic1 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0 /lambda-adapter /opt/extensions/lambda-adapter
# Copy only the binary because the Next.js standalone server needs no other part of the Node.js distribution.
COPY --from=node:26.13.1-slim /usr/local/bin/node /usr/local/bin/node

# Point HOME at /tmp because Lambda mounts every other path read-only.
ENV BUNDLE_PATH=/usr/local/bundle \
    HANAMI_ENV=production \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOME=/tmp \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=monolith-builder /usr/local/bundle /usr/local/bundle
WORKDIR /app/monolith
COPY monolith/ .

WORKDIR /app/frontend
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static
COPY --from=frontend-builder /app/public ./public

COPY --from=server-builder /app/server/target/release/dystopia-server /app/server/dystopia-server

COPY lambda/image/start lambda/image/task.mjs /app/lambda/
RUN chmod 755 /app/lambda/start

ENTRYPOINT ["/app/lambda/start"]
