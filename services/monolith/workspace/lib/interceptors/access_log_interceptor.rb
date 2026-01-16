require 'gruf'
require 'json'

module Interceptors
  class AccessLogInterceptor < Gruf::Interceptors::ServerInterceptor
    def call
      start_time = Time.now

      # yield to the next interceptor/handler
      result = yield

      duration = (Time.now - start_time) * 1000 # ms
      user_id = ::Current.user_id

      log_entry = {
        time: start_time.iso8601,
        method: request.method_key,
        service: request.service_key,
        user_id: user_id,
        duration_ms: duration.round(2),
        status: 'OK',
      }

      Hanami.logger.info(log_entry.to_json)

      result
    rescue => e
      duration = (Time.now - start_time) * 1000 # ms
      user_id = ::Current.user_id

      log_entry = {
        time: start_time.iso8601,
        method: request.method_key,
        service: request.service_key,
        user_id: user_id,
        duration_ms: duration.round(2),
        status: 'ERROR',
        error: e.message,
        error_class: e.class.name
      }

      Hanami.logger.error(log_entry.to_json)

      raise e
    end
  end
end
