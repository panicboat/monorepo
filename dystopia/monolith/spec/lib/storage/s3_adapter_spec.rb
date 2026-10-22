# frozen_string_literal: true

require "spec_helper"
require "aws-sdk-s3"
require "storage/s3_adapter"

RSpec.describe Storage::S3Adapter do
  let(:client) { Aws::S3::Client.new(stub_responses: true, region: "ap-northeast-1", credentials: Aws::Credentials.new("AKID", "SECRET")) }
  let(:adapter) { described_class.new(client: client, bucket: "media-bucket") }

  describe "#tag" do
    it "puts the tags on the object and reports success" do
      tagged = adapter.tag(key: "media/p1/m1.png", tags: { "owner-account-id" => "account-1" })

      request = client.api_requests.find { |call| call[:operation_name] == :put_object_tagging }
      expect(tagged).to be true
      expect(request[:params]).to include(
        bucket: "media-bucket",
        key: "media/p1/m1.png",
        tagging: { tag_set: [{ key: "owner-account-id", value: "account-1" }] }
      )
    end

    it "reports failure for an object that does not exist" do
      client.stub_responses(:put_object_tagging, "NoSuchKey")

      expect(adapter.tag(key: "media/p1/missing.png", tags: { "owner-account-id" => "account-1" })).to be false
    end

    it "reports failure when the role may not tag objects" do
      client.stub_responses(:put_object_tagging, "AccessDenied")

      expect(adapter.tag(key: "media/p1/m1.png", tags: { "owner-account-id" => "account-1" })).to be false
    end

    it "does not call the bucket for an empty key" do
      expect(adapter.tag(key: "", tags: { "owner-account-id" => "account-1" })).to be false
      expect(client.api_requests).to be_empty
    end
  end

  describe "#download_url" do
    let(:hour) { Time.utc(2026, 10, 22, 9) }

    it "returns the same URL within an hour so browsers can cache the media" do
      first = adapter.download_url(key: "media/p1/m1.jpg", now: hour + 5 * 60)
      later = adapter.download_url(key: "media/p1/m1.jpg", now: hour + 55 * 60)

      expect(later).to eq(first)
    end

    it "signs a new URL in the next hour" do
      this_hour = adapter.download_url(key: "media/p1/m1.jpg", now: hour + 59 * 60)
      next_hour = adapter.download_url(key: "media/p1/m1.jpg", now: hour + 61 * 60)

      expect(next_hour).not_to eq(this_hour)
    end

    it "signs at the start of the hour and keeps the URL valid for two hours" do
      query = URI.decode_www_form(URI(adapter.download_url(key: "media/p1/m1.jpg", now: hour + 30 * 60)).query).to_h

      expect(query).to include("X-Amz-Date" => "20261022T090000Z", "X-Amz-Expires" => "7200")
    end

    it "returns an empty string for an empty key" do
      expect(adapter.download_url(key: "")).to eq("")
    end
  end
end
