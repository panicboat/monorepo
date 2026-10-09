# frozen_string_literal: true

require_relative "adapter"

module Storage
  class S3Adapter < Adapter
    UPLOAD_URL_EXPIRES_IN = 300
    DOWNLOAD_URL_EXPIRES_IN = 3600

    def initialize(client: nil, bucket: ENV.fetch("MEDIA_BUCKET_NAME"), region: ENV.fetch("MEDIA_BUCKET_REGION", "ap-northeast-1"))
      require "aws-sdk-s3"
      @client = client || Aws::S3::Client.new(region: region)
      @bucket = bucket
      @presigner = Aws::S3::Presigner.new(client: @client)
    end

    def upload_url(key:, content_type:)
      @presigner.presigned_url(:put_object, bucket: @bucket, key: key, content_type: content_type, expires_in: UPLOAD_URL_EXPIRES_IN)
    end

    def download_url(key:)
      return "" if key.to_s.empty?

      @presigner.presigned_url(:get_object, bucket: @bucket, key: key, expires_in: DOWNLOAD_URL_EXPIRES_IN)
    end

    def delete(key:)
      return false if key.to_s.empty?

      @client.delete_object(bucket: @bucket, key: key)
      true
    rescue Aws::S3::Errors::ServiceError => e
      warn "[Storage::S3Adapter] Failed to delete #{key}: #{e.message}"
      # FALLBACK: Return false when deletion fails.
      false
    end

    def tag(key:, tags:)
      return false if key.to_s.empty?

      tag_set = tags.map { |name, value| { key: name.to_s, value: value.to_s } }
      @client.put_object_tagging(bucket: @bucket, key: key, tagging: { tag_set: tag_set })
      true
    rescue Aws::S3::Errors::ServiceError => e
      warn "[Storage::S3Adapter] Failed to tag #{key}: #{e.message}"
      # FALLBACK: Return false when the object is missing or cannot be tagged.
      false
    end
  end
end
