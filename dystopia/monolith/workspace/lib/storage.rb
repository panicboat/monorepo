# frozen_string_literal: true

require "cgi"
require_relative "storage/adapter"
require_relative "storage/local_adapter"

module Storage
  class << self
    # Get the current storage adapter.
    # @return [Storage::Adapter]
    def adapter
      @adapter ||= default_adapter
    end

    # Set the storage adapter.
    # @param adapter [Storage::Adapter]
    def adapter=(adapter)
      @adapter = adapter
    end

    # Reset to default adapter.
    def reset!
      @adapter = nil
    end

    # Generate a URL for uploading a file.
    # @param key [String] The storage key/path for the file
    # @param content_type [String] The MIME type of the file
    # @return [String] The upload URL
    def upload_url(key:, content_type:)
      adapter.upload_url(key: key, content_type: content_type)
    end

    # Generate a URL for downloading a file.
    # @param key [String] The storage key/path for the file
    # @return [String] The download URL
    def download_url(key:)
      adapter.download_url(key: key)
    end

    # Delete a file from storage.
    # @param key [String] The storage key/path for the file
    # @return [Boolean] true if successful
    def delete(key:)
      adapter.delete(key: key)
    end

    private

    def default_adapter
      LocalAdapter.new
    end
  end
end
