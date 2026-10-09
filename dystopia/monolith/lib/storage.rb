# frozen_string_literal: true

require "cgi"
require_relative "storage/adapter"
require_relative "storage/local_adapter"

module Storage
  class << self
    def adapter
      @adapter ||= default_adapter
    end

    def adapter=(adapter)
      @adapter = adapter
    end

    def reset!
      @adapter = nil
    end

    def upload_url(key:, content_type:)
      adapter.upload_url(key: key, content_type: content_type)
    end

    def download_url(key:)
      adapter.download_url(key: key)
    end

    def delete(key:)
      adapter.delete(key: key)
    end

    def tag(key:, tags:)
      adapter.tag(key: key, tags: tags)
    end

    private

    def default_adapter
      env = ENV.fetch("HANAMI_ENV", "development")
      if env == "development" || env == "test"
        LocalAdapter.new
      else
        require_relative "storage/s3_adapter"
        S3Adapter.new
      end
    end
  end
end
