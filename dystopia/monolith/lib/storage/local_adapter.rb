# frozen_string_literal: true

require_relative "adapter"

module Storage
  class LocalAdapter < Adapter
    def initialize(base_url: nil, upload_path: "/storage/upload", download_path: "/uploads")
      # FALLBACK: Use localhost when APP_URL is not configured.
      @base_url = base_url || ENV.fetch("APP_URL", "http://localhost:3000")
      @upload_path = upload_path
      @download_path = download_path
    end

    def upload_url(key:, content_type:)
      "#{@base_url}#{@upload_path}?key=#{CGI.escape(key)}&content_type=#{CGI.escape(content_type)}"
    end

    def download_url(key:)
      return "" if key.to_s.empty?

      "#{@base_url}#{@download_path}/#{key}"
    end

    def delete(key:)
      return false if key.to_s.empty?

      path = File.join("public", "uploads", key)
      return false unless File.exist?(path)

      File.delete(path)
      true
    rescue => e
      warn "[Storage::LocalAdapter] Failed to delete #{key}: #{e.message}"
      # FALLBACK: Return false when deletion fails.
      false
    end

    # Local files carry no tags, so the owner is kept in the database row alone.
    def tag(key:, tags:)
      File.exist?(File.join("public", "uploads", key.to_s))
    end
  end
end
