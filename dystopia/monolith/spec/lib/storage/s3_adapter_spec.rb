# frozen_string_literal: true

require "spec_helper"
require "aws-sdk-s3"
require "storage/s3_adapter"

RSpec.describe Storage::S3Adapter do
  let(:client) { Aws::S3::Client.new(stub_responses: true, region: "ap-northeast-1", credentials: Aws::Credentials.new("AKID", "SECRET")) }
  let(:adapter) { described_class.new(client: client, bucket: "media-bucket") }

  describe "#delete_many" do
    def delete_requests
      client.api_requests.select { |call| call[:operation_name] == :delete_objects }
    end

    it "deletes the keys in one quiet request and reports success" do
      expect(adapter.delete_many(keys: %w[media/p1/a.png media/p1/b.png])).to be true

      expect(delete_requests.size).to eq(1)
      expect(delete_requests.first[:params]).to include(
        bucket: "media-bucket",
        delete: { objects: [{ key: "media/p1/a.png" }, { key: "media/p1/b.png" }], quiet: true }
      )
    end

    it "splits the keys into requests of at most 1000" do
      keys = Array.new(1001) { |i| "media/p1/#{i}.png" }

      expect(adapter.delete_many(keys: keys)).to be true

      expect(delete_requests.map { |call| call[:params][:delete][:objects].size }).to eq([1000, 1])
    end

    it "reports failure when an object is not deleted" do
      client.stub_responses(:delete_objects, errors: [{ key: "media/p1/a.png", code: "AccessDenied", message: "Access Denied" }])

      expect(adapter.delete_many(keys: ["media/p1/a.png"])).to be false
    end

    it "keeps deleting the remaining batches after one fails" do
      client.stub_responses(:delete_objects, [{ errors: [{ key: "media/p1/0.png", code: "InternalError", message: "boom" }] }, {}])

      expect(adapter.delete_many(keys: Array.new(1001) { |i| "media/p1/#{i}.png" })).to be false
      expect(delete_requests.size).to eq(2)
    end

    it "reports failure when the request fails" do
      client.stub_responses(:delete_objects, "AccessDenied")

      expect(adapter.delete_many(keys: ["media/p1/a.png"])).to be false
    end

    it "does not call the bucket without keys" do
      expect(adapter.delete_many(keys: [])).to be true
      expect(client.api_requests).to be_empty
    end
  end

  describe "#delete_prefix" do
    def requests(operation)
      client.api_requests.select { |call| call[:operation_name] == operation }
    end

    it "lists the objects under the prefix page by page and deletes each page" do
      client.stub_responses(:list_objects_v2, [
        { contents: [{ key: "media/p1/a.png" }, { key: "media/p1/b.png" }], is_truncated: true, next_continuation_token: "page-2" },
        { contents: [{ key: "media/p1/c.png" }], is_truncated: false }
      ])

      expect(adapter.delete_prefix(prefix: "media/p1/")).to be true

      expect(requests(:list_objects_v2).map { |call| call[:params].slice(:bucket, :prefix, :continuation_token) }).to eq([
        { bucket: "media-bucket", prefix: "media/p1/" },
        { bucket: "media-bucket", prefix: "media/p1/", continuation_token: "page-2" }
      ])
      expect(requests(:delete_objects).map { |call| call[:params][:delete][:objects] }).to eq([
        [{ key: "media/p1/a.png" }, { key: "media/p1/b.png" }],
        [{ key: "media/p1/c.png" }]
      ])
    end

    it "does not send a delete request when nothing is under the prefix" do
      client.stub_responses(:list_objects_v2, { contents: [] })

      expect(adapter.delete_prefix(prefix: "media/p1/")).to be true
      expect(requests(:delete_objects)).to be_empty
    end

    it "reports failure when the objects cannot be listed" do
      client.stub_responses(:list_objects_v2, "AccessDenied")

      expect(adapter.delete_prefix(prefix: "media/p1/")).to be false
    end

    it "reports failure when an object is not deleted" do
      client.stub_responses(:list_objects_v2, { contents: [{ key: "media/p1/a.png" }] })
      client.stub_responses(:delete_objects, errors: [{ key: "media/p1/a.png", code: "AccessDenied", message: "Access Denied" }])

      expect(adapter.delete_prefix(prefix: "media/p1/")).to be false
    end

    it "does not call the bucket for an empty prefix" do
      expect(adapter.delete_prefix(prefix: "")).to be false
      expect(client.api_requests).to be_empty
    end
  end

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
