# frozen_string_literal: true

require "spec_helper"

RSpec.describe Media::UseCases::DiscardMedia, type: :database do
  let(:use_case) { described_class.new }
  let(:files) { Hanami.app["db.gateway"].connection[:media__files] }

  def insert_file(media_key:, thumbnail_key: nil)
    SecureRandom.uuid_v7.tap do |id|
      files.insert(id: id, media_type: "image", media_key: media_key, thumbnail_key: thumbnail_key, uploader_profile_id: SecureRandom.uuid_v7)
    end
  end

  before { allow(Storage).to receive(:delete).and_return(true) }

  it "deletes the file, the thumbnail and the row of each media" do
    discarded = insert_file(media_key: "media/a.jpg", thumbnail_key: "media/a_thumb.jpg")
    kept = insert_file(media_key: "media/b.jpg")

    use_case.call(ids: [discarded])

    expect(Storage).to have_received(:delete).with(key: "media/a.jpg")
    expect(Storage).to have_received(:delete).with(key: "media/a_thumb.jpg")
    expect(files.where(id: discarded).count).to eq(0)
    expect(files.where(id: kept).count).to eq(1)
  end

  it "keeps the row of a media whose file is not deleted" do
    failed = insert_file(media_key: "media/a.jpg")
    deleted = insert_file(media_key: "media/b.jpg")
    allow(Storage).to receive(:delete).with(key: "media/a.jpg").and_return(false)

    use_case.call(ids: [failed, deleted])

    expect(files.where(id: failed).count).to eq(1)
    expect(files.where(id: deleted).count).to eq(0)
  end
end
