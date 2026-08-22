# frozen_string_literal: true

require "spec_helper"
require "storage"

RSpec.describe Storage do
  let(:mock_adapter) { instance_double(Storage::Adapter) }

  after do
    # Reset adapter after each test
    described_class.reset!
  end

  describe ".adapter" do
    it "returns LocalAdapter by default" do
      expect(described_class.adapter).to be_a(Storage::LocalAdapter)
    end
  end

  describe ".adapter=" do
    it "allows setting a custom adapter" do
      described_class.adapter = mock_adapter

      expect(described_class.adapter).to eq(mock_adapter)
    end
  end

  describe ".reset!" do
    it "resets to default adapter" do
      described_class.adapter = mock_adapter
      described_class.reset!

      expect(described_class.adapter).to be_a(Storage::LocalAdapter)
    end
  end

  describe ".upload_url" do
    it "delegates to adapter" do
      described_class.adapter = mock_adapter
      allow(mock_adapter).to receive(:upload_url).with(key: "test.jpg", content_type: "image/jpeg").and_return("http://upload.url")

      result = described_class.upload_url(key: "test.jpg", content_type: "image/jpeg")

      expect(result).to eq("http://upload.url")
      expect(mock_adapter).to have_received(:upload_url).with(key: "test.jpg", content_type: "image/jpeg")
    end
  end

  describe ".download_url" do
    it "delegates to adapter" do
      described_class.adapter = mock_adapter
      allow(mock_adapter).to receive(:download_url).with(key: "test.jpg").and_return("http://download.url")

      result = described_class.download_url(key: "test.jpg")

      expect(result).to eq("http://download.url")
      expect(mock_adapter).to have_received(:download_url).with(key: "test.jpg")
    end
  end

  describe ".delete" do
    it "delegates to adapter" do
      described_class.adapter = mock_adapter
      allow(mock_adapter).to receive(:delete).with(key: "test.jpg").and_return(true)

      result = described_class.delete(key: "test.jpg")

      expect(result).to be(true)
      expect(mock_adapter).to have_received(:delete).with(key: "test.jpg")
    end
  end

  describe "integration with LocalAdapter" do
    it "generates local upload URL" do
      url = described_class.upload_url(key: "casts/123/photo.jpg", content_type: "image/jpeg")

      expect(url).to include("/storage/upload")
      expect(url).to include("key=")
      expect(url).to include("content_type=")
    end

    it "generates local download URL" do
      url = described_class.download_url(key: "casts/123/photo.jpg")

      expect(url).to include("/uploads/casts/123/photo.jpg")
    end
  end
end
