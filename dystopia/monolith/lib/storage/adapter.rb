# frozen_string_literal: true

module Storage
  # Base adapter interface for storage backends.
  # Slice-specific adapters (e.g., S3) should inherit from this class.
  class Adapter
    # Generate a URL for uploading a file.
    # @param key [String] The storage key/path for the file
    # @param content_type [String] The MIME type of the file
    # @return [String] The upload URL
    def upload_url(key:, content_type:)
      raise NotImplementedError, "#{self.class}#upload_url must be implemented"
    end

    # Generate a URL for downloading a file.
    # @param key [String] The storage key/path for the file
    # @return [String] The download URL
    def download_url(key:)
      raise NotImplementedError, "#{self.class}#download_url must be implemented"
    end

    # Delete a file from storage.
    # @param key [String] The storage key/path for the file
    # @return [Boolean] true if successful
    def delete(key:)
      raise NotImplementedError, "#{self.class}#delete must be implemented"
    end
  end
end
