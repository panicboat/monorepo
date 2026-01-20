# frozen_string_literal: true

require "spec_helper"
require "storage/local_adapter"

RSpec.describe Storage::LocalAdapter do
  let(:adapter) { described_class.new(base_url: "http://localhost:3000") }

  describe "#upload_url" do
    it "returns a URL pointing to the local uploader middleware" do
      url = adapter.upload_url(key: "casts/123/photo.jpg", content_type: "image/jpeg")

      expect(url).to include("http://localhost:3000/storage/upload")
      expect(url).to include("key=casts%2F123%2Fphoto.jpg")
      expect(url).to include("content_type=image%2Fjpeg")
    end

    it "escapes special characters in key and content_type" do
      url = adapter.upload_url(key: "path/with spaces/file.jpg", content_type: "image/jpeg")

      expect(url).to include("key=path%2Fwith+spaces%2Ffile.jpg")
    end
  end

  describe "#download_url" do
    it "returns a URL pointing to public/uploads" do
      url = adapter.download_url(key: "casts/123/photo.jpg")

      expect(url).to eq("http://localhost:3000/uploads/casts/123/photo.jpg")
    end

    it "returns empty string for nil key" do
      url = adapter.download_url(key: nil)

      expect(url).to eq("")
    end

    it "returns empty string for empty key" do
      url = adapter.download_url(key: "")

      expect(url).to eq("")
    end
  end

  describe "#delete" do
    let(:test_file_path) { "public/uploads/test/delete_me.txt" }

    before do
      FileUtils.mkdir_p(File.dirname(test_file_path))
      File.write(test_file_path, "test content")
    end

    after do
      FileUtils.rm_rf("public/uploads/test")
    end

    it "deletes the file and returns true" do
      expect(File.exist?(test_file_path)).to be(true)

      result = adapter.delete(key: "test/delete_me.txt")

      expect(result).to be(true)
      expect(File.exist?(test_file_path)).to be(false)
    end

    it "returns false for non-existent file" do
      result = adapter.delete(key: "non/existent/file.txt")

      expect(result).to be(false)
    end

    it "returns false for empty key" do
      result = adapter.delete(key: "")

      expect(result).to be(false)
    end

    it "returns false for nil key" do
      result = adapter.delete(key: nil)

      expect(result).to be(false)
    end
  end

  describe "custom configuration" do
    it "allows custom base_url" do
      adapter = described_class.new(base_url: "https://custom.example.com")

      url = adapter.download_url(key: "test.jpg")

      expect(url).to start_with("https://custom.example.com")
    end

    it "allows custom upload_path" do
      adapter = described_class.new(base_url: "http://localhost:3000", upload_path: "/custom/upload")

      url = adapter.upload_url(key: "test.jpg", content_type: "image/jpeg")

      expect(url).to include("/custom/upload")
    end

    it "allows custom download_path" do
      adapter = described_class.new(base_url: "http://localhost:3000", download_path: "/custom/files")

      url = adapter.download_url(key: "test.jpg")

      expect(url).to include("/custom/files/test.jpg")
    end
  end
end
