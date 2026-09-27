# frozen_string_literal: true

port ENV.fetch("HANAMI_PORT", 2300)
environment ENV.fetch("HANAMI_ENV", "development")


max_threads_count = ENV.fetch("HANAMI_MAX_THREADS", 5)
min_threads_count = ENV.fetch("HANAMI_MIN_THREADS") { max_threads_count }

threads min_threads_count, max_threads_count


puma_concurrency = Integer(ENV.fetch("HANAMI_WEB_CONCURRENCY", 0))
puma_cluster_mode = puma_concurrency > 1

workers puma_concurrency


if puma_cluster_mode
  preload_app!

  before_fork do
    Hanami.shutdown
  end
end
