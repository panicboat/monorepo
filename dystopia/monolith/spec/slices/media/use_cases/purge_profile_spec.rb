# frozen_string_literal: true

require "spec_helper"

RSpec.describe Media::UseCases::PurgeProfile, type: :database do
  let(:use_case) { described_class.new }
  let(:files) { Hanami.app["db.gateway"].connection[:media__files] }
  let(:purged_profile_id) { SecureRandom.uuid_v7 }
  let(:other_profile_id) { SecureRandom.uuid_v7 }

  def insert_file(profile_id:, media_key:, thumbnail_key: nil)
    files.insert(
      id: SecureRandom.uuid_v7,
      media_type: "image",
      media_key: media_key,
      thumbnail_key: thumbnail_key,
      uploader_profile_id: profile_id
    )
  end

  before do
    insert_file(profile_id: purged_profile_id, media_key: "media/image/a.jpg", thumbnail_key: "media/image/a_thumb.jpg")
    insert_file(profile_id: purged_profile_id, media_key: "media/image/b.jpg")
    insert_file(profile_id: other_profile_id, media_key: "media/image/c.jpg")
    allow(Storage).to receive(:delete).and_return(true)
  end

  it "deletes the files and thumbnails the profile uploaded, then the rows" do
    use_case.call(profile_id: purged_profile_id)

    expect(Storage).to have_received(:delete).with(key: "media/image/a.jpg")
    expect(Storage).to have_received(:delete).with(key: "media/image/a_thumb.jpg")
    expect(Storage).to have_received(:delete).with(key: "media/image/b.jpg")
    expect(Storage).to have_received(:delete).exactly(3).times
    expect(files.where(uploader_profile_id: purged_profile_id).count).to eq(0)
    expect(files.where(uploader_profile_id: other_profile_id).count).to eq(1)
  end

  it "keeps the rows and raises when Storage reports a file was not deleted" do
    allow(Storage).to receive(:delete).and_return(true)
    allow(Storage).to receive(:delete).with(key: "media/image/b.jpg").and_return(false)

    expect { use_case.call(profile_id: purged_profile_id) }.to raise_error(described_class::FileDeletionError, /media\/image\/b\.jpg/)
    expect(files.where(uploader_profile_id: purged_profile_id).count).to eq(2)
  end

  it "keeps the rows when Storage raises" do
    allow(Storage).to receive(:delete).and_raise("s3 down")

    expect { use_case.call(profile_id: purged_profile_id) }.to raise_error("s3 down")
    expect(files.where(uploader_profile_id: purged_profile_id).count).to eq(2)
  end
end
