FROM node:24.21.0-slim AS frontend-builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
RUN corepack enable && \
    apt-get update -qq && \
    apt-get install -y --no-install-recommends git ca-certificates

WORKDIR /app
COPY frontend/ .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM ruby:4.0.3-slim AS monolith-builder
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends build-essential libpq-dev git libyaml-dev

WORKDIR /app
COPY monolith/Gemfile monolith/Gemfile.lock ./
ENV BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3
RUN bundle config set --local frozen true && \
    bundle install

FROM ruby:4.0.3-slim AS runner
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends libpq5 postgresql-client-17 libstdc++6 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0 /lambda-adapter /opt/extensions/lambda-adapter
# Copy only the binary because the Next.js standalone server needs no other part of the Node.js distribution.
COPY --from=node:24.21.0-slim /usr/local/bin/node /usr/local/bin/node

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

COPY lambda/image/start lambda/image/task.mjs /app/lambda/
RUN chmod 755 /app/lambda/start

ENTRYPOINT ["/app/lambda/start"]
