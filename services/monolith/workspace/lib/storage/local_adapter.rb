# frozen_string_literal: true

require_relative "adapter"

module Storage
  # Local disk storage adapter for development.
  # Works with Middleware::LocalUploader for handling uploads.
  class LocalAdapter < Adapter
    def initialize(base_url: nil, upload_path: "/storage/upload", download_path: "/uploads")
      # FALLBACK: Uses localhost URL when APP_URL is not configured
      @base_url = base_url || ENV.fetch("APP_URL", "http://localhost:3000")
      @upload_path = upload_path
      @download_path = download_path
    end

    # Generate a URL for uploading a file via LocalUploader middleware.
    # @param key [String] The storage key/path for the file
    # @param content_type [String] The MIME type of the file
    # @return [String] The upload URL
    def upload_url(key:, content_type:)
      "#{@base_url}#{@upload_path}?key=#{CGI.escape(key)}&content_type=#{CGI.escape(content_type)}"
    end

    # Generate a URL for downloading a file from public/uploads.
    # @param key [String] The storage key/path for the file
    # @return [String] The download URL
    def download_url(key:)
      return "" if key.to_s.empty?

      "#{@base_url}#{@download_path}/#{key}"
    end

    # Delete a file from local storage.
    # @param key [String] The storage key/path for the file
    # @return [Boolean] true if successful
    def delete(key:)
      return false if key.to_s.empty?

      path = File.join("public", "uploads", key)
      return false unless File.exist?(path)

      File.delete(path)
      true
    rescue => e
      warn "[Storage::LocalAdapter] Failed to delete #{key}: #{e.message}"
      # FALLBACK: Returns false on delete failure
      false
    end
  end
end
