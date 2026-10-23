require 'gruf'
require 'json'

module Interceptors
  class AccessLogInterceptor < Gruf::Interceptors::ServerInterceptor
    # Reads request.context, not ::Current: the inner AuthenticationInterceptor clears ::Current in its ensure before this logs.
    def call
      start_time = Time.now

      result = yield

      duration = (Time.now - start_time) * 1000

      log_entry = {
        time: start_time.iso8601,
        request_id: request.context[:request_id],
        method: request.method_key,
        service: request.service_key,
        account_id: request.context[:account_id],
        profile_id: request.context[:profile_id],
        duration_ms: duration.round(2),
        status: 'OK',
      }

      Hanami.logger.info(log_entry.to_json)

      result
    rescue => e
      duration = (Time.now - start_time) * 1000

      log_entry = {
        time: start_time.iso8601,
        request_id: request.context[:request_id],
        method: request.method_key,
        service: request.service_key,
        account_id: request.context[:account_id],
        profile_id: request.context[:profile_id],
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
