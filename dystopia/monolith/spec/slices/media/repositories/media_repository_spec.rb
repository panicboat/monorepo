# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Media::Repositories::MediaRepository", type: :database do
  let(:repo) { Hanami.app.slices[:media]["repositories.media_repository"] }

  describe "#create" do
    it "creates a new media record with a url resolved from Storage" do
      media_key = "media/image/#{SecureRandom.uuid_v7}.jpg"
      media = repo.create(
        id: SecureRandom.uuid_v7,
        media_type: "image",
        media_key: media_key,
        filename: "image.jpg",
        content_type: "image/jpeg",
        size_bytes: 1024
      )

      expect(media.id).not_to be_nil
      expect(media.media_type).to eq("image")
      expect(media.url).to eq(Storage.download_url(key: media_key))
      expect(media.filename).to eq("image.jpg")
    end
  end

  describe "#find_by_id" do
    let(:media_key) { "media/video/#{SecureRandom.uuid_v7}.mp4" }
    let!(:created_media) do
      repo.create(
        id: SecureRandom.uuid_v7,
        media_type: "video",
        media_key: media_key,
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
      media = repo.find_by_id(SecureRandom.uuid_v7)
      expect(media).to be_nil
    end

    it "resolves the url from Storage using the stored media_key" do
      media = repo.find_by_id(created_media.id)

      expect(media.url).to eq(Storage.download_url(key: media_key))
    end

    it "resolves the thumbnail_url from Storage using the stored thumbnail_key" do
      thumbnail_key = "media/video/#{SecureRandom.uuid_v7}_thumb.jpg"
      created = repo.create(
        id: SecureRandom.uuid_v7,
        media_type: "video",
        media_key: "media/video/#{SecureRandom.uuid_v7}.mp4",
        thumbnail_key: thumbnail_key
      )

      media = repo.find_by_id(created.id)

      expect(media.thumbnail_url).to eq(Storage.download_url(key: thumbnail_key))
    end

    it "returns an empty url when there is no media_key" do
      created = repo.create(id: SecureRandom.uuid_v7, media_type: "image")

      media = repo.find_by_id(created.id)

      expect(media.url).to eq("")
    end
  end

  describe "#find_by_ids" do
    let!(:media1) do
      repo.create(id: SecureRandom.uuid_v7, media_type: "image", media_key: "media/image/#{SecureRandom.uuid_v7}.jpg")
    end

    let!(:media2) do
      repo.create(id: SecureRandom.uuid_v7, media_type: "image", media_key: "media/image/#{SecureRandom.uuid_v7}.jpg")
    end

    it "returns multiple media records" do
      result = repo.find_by_ids([media1.id, media2.id])
      expect(result.size).to eq(2)
    end

    it "returns empty array for empty input" do
      expect(repo.find_by_ids([])).to eq([])
      expect(repo.find_by_ids(nil)).to eq([])
    end

    it "resolves urls for every returned media" do
      result = repo.find_by_ids([media1.id])

      expect(result.first.url).to eq(Storage.download_url(key: media1.media_key))
    end
  end

  describe "#delete" do
    let!(:media) do
      repo.create(id: SecureRandom.uuid_v7, media_type: "image", media_key: "media/image/#{SecureRandom.uuid_v7}.jpg")
    end

    it "deletes the media record" do
      repo.delete(media.id)
      expect(repo.find_by_id(media.id)).to be_nil
    end
  end
end
