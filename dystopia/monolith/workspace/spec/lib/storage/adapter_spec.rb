# frozen_string_literal: true

require "spec_helper"
require "storage/adapter"

RSpec.describe Storage::Adapter do
  let(:adapter) { described_class.new }

  describe "#upload_url" do
    it "raises NotImplementedError" do
      expect {
        adapter.upload_url(key: "test.jpg", content_type: "image/jpeg")
      }.to raise_error(NotImplementedError, /upload_url must be implemented/)
    end
  end

  describe "#download_url" do
    it "raises NotImplementedError" do
      expect {
        adapter.download_url(key: "test.jpg")
      }.to raise_error(NotImplementedError, /download_url must be implemented/)
    end
  end

  describe "#delete" do
    it "raises NotImplementedError" do
      expect {
        adapter.delete(key: "test.jpg")
      }.to raise_error(NotImplementedError, /delete must be implemented/)
    end
  end
end
