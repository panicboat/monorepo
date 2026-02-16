# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Media::Repositories::MediaRepository", type: :database do
  let(:repo) { Hanami.app.slices[:media]["repositories.media_repository"] }

  describe "#create" do
    it "creates a new media record" do
      media = repo.create(
        id: SecureRandom.uuid,
        media_type: "image",
        url: "https://example.com/image.jpg",
        thumbnail_url: "https://example.com/thumb.jpg",
        filename: "image.jpg",
        content_type: "image/jpeg",
        size_bytes: 1024,
        media_key: "media/image/#{SecureRandom.uuid}.jpg"
      )

      expect(media.id).not_to be_nil
      expect(media.media_type).to eq("image")
      expect(media.url).to eq("https://example.com/image.jpg")
      expect(media.filename).to eq("image.jpg")
    end
  end

  describe "#find_by_id" do
    let!(:created_media) do
      repo.create(
        id: SecureRandom.uuid,
        media_type: "video",
        url: "https://example.com/video.mp4",
        filename: "video.mp4",
        content_type: "video/mp4"
      )
    end

    it "returns the media when found" do
      media = repo.find_by_id(created_media.id)
      expect(media).not_to be_nil
      expect(media.id).to eq(created_media.id)
    end

    it "returns nil when not found" do
      media = repo.find_by_id(SecureRandom.uuid)
      expect(media).to be_nil
    end
  end

  describe "#find_by_ids" do
    let!(:media1) do
      repo.create(
        id: SecureRandom.uuid,
        media_type: "image",
        url: "https://example.com/1.jpg"
      )
    end

    let!(:media2) do
      repo.create(
        id: SecureRandom.uuid,
        media_type: "image",
        url: "https://example.com/2.jpg"
      )
    end

    it "returns multiple media records" do
      result = repo.find_by_ids([media1.id, media2.id])
      expect(result.size).to eq(2)
    end

    it "returns empty array for empty input" do
      expect(repo.find_by_ids([])).to eq([])
      expect(repo.find_by_ids(nil)).to eq([])
    end
  end

  describe "#delete" do
    let!(:media) do
      repo.create(
        id: SecureRandom.uuid,
        media_type: "image",
        url: "https://example.com/delete.jpg"
      )
    end

    it "deletes the media record" do
      repo.delete(media.id)
      expect(repo.find_by_id(media.id)).to be_nil
    end
  end
end
