# frozen_string_literal: true

require "spec_helper"
require "aws-sdk-s3"
require "storage/s3_adapter"

RSpec.describe Storage::S3Adapter do
  let(:client) { Aws::S3::Client.new(stub_responses: true, region: "ap-northeast-1") }
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
end
