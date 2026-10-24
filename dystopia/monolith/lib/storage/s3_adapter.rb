# frozen_string_literal: true

require_relative "adapter"

module Storage
  class S3Adapter < Adapter
    DELETE_BATCH_SIZE = 1000
    UPLOAD_URL_EXPIRES_IN = 300
    DOWNLOAD_URL_EXPIRES_IN = 7200
    SIGNING_WINDOW = 3600

    def initialize(client: nil, bucket: ENV.fetch("MEDIA_BUCKET_NAME"), region: ENV.fetch("MEDIA_BUCKET_REGION", "ap-northeast-1"))
      require "aws-sdk-s3"
      @client = client || Aws::S3::Client.new(region: region)
      @bucket = bucket
      @presigner = Aws::S3::Presigner.new(client: @client)
    end

    def upload_url(key:, content_type:)
      @presigner.presigned_url(:put_object, bucket: @bucket, key: key, content_type: content_type, expires_in: UPLOAD_URL_EXPIRES_IN)
    end

    # Sign at the start of the hour so the URL stays the same for an hour and browsers can cache the media.
    def download_url(key:, now: Time.now)
      return "" if key.to_s.empty?

      signed_at = Time.at(now.to_i - (now.to_i % SIGNING_WINDOW)).utc
      @presigner.presigned_url(:get_object, bucket: @bucket, key: key, expires_in: DOWNLOAD_URL_EXPIRES_IN, time: signed_at)
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

    def delete_many(keys:)
      keys.each_slice(DELETE_BATCH_SIZE).map { |batch| delete_batch(batch) }.all?
    end

    def delete_prefix(prefix:)
      return false if prefix.to_s.empty?

      @client.list_objects_v2(bucket: @bucket, prefix: prefix).each_page.map { |page| delete_many(keys: page.contents.map(&:key)) }.all?
    rescue Aws::S3::Errors::ServiceError => e
      warn "[Storage::S3Adapter] Failed to list objects under #{prefix}: #{e.message}"
      # FALLBACK: Return false when the objects cannot be listed.
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

    private

    def delete_batch(keys)
      response = @client.delete_objects(bucket: @bucket, delete: { objects: keys.map { |key| { key: key } }, quiet: true })
      return true if response.errors.empty?

      warn "[Storage::S3Adapter] Failed to delete #{response.errors.size} of #{keys.size} objects: #{response.errors.first.message}"
      # FALLBACK: Return false when any object in the batch is not deleted.
      false
    rescue Aws::S3::Errors::ServiceError => e
      warn "[Storage::S3Adapter] Failed to delete #{keys.size} objects: #{e.message}"
      # FALLBACK: Return false when the batch request fails.
      false
    end
  end
end
