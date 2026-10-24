# frozen_string_literal: true

require "spec_helper"

RSpec.describe Media::UseCases::PurgeProfile, type: :database do
  let(:use_case) { described_class.new }
  let(:files) { Hanami.app["db.gateway"].connection[:media__files] }
  let(:purged_profile_id) { SecureRandom.uuid_v7 }
  let(:other_profile_id) { SecureRandom.uuid_v7 }
  let(:prefix) { "media/#{purged_profile_id}/" }

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
    insert_file(profile_id: purged_profile_id, media_key: "#{prefix}a.jpg", thumbnail_key: "#{prefix}a_thumb.jpg")
    insert_file(profile_id: purged_profile_id, media_key: "media/image/b.jpg", thumbnail_key: "media/image/b_thumb.jpg")
    insert_file(profile_id: other_profile_id, media_key: "media/image/c.jpg")
    allow(Storage).to receive(:delete_prefix).and_return(true)
    allow(Storage).to receive(:delete_many).and_return(true)
  end

  it "deletes every object under the profile's key prefix, then the rows" do
    use_case.call(profile_id: purged_profile_id)

    expect(Storage).to have_received(:delete_prefix).with(prefix: prefix)
    expect(files.where(uploader_profile_id: purged_profile_id).count).to eq(0)
    expect(files.where(uploader_profile_id: other_profile_id).count).to eq(1)
  end

  it "deletes the keys its rows hold outside the prefix in one call" do
    use_case.call(profile_id: purged_profile_id)

    expect(Storage).to have_received(:delete_many).once
    expect(Storage).to have_received(:delete_many) do |keys:|
      expect(keys).to contain_exactly("media/image/b.jpg", "media/image/b_thumb.jpg")
    end
  end

  it "keeps the rows and raises when an object under the prefix is not deleted" do
    allow(Storage).to receive(:delete_prefix).and_return(false)

    expect { use_case.call(profile_id: purged_profile_id) }.to raise_error(described_class::FileDeletionError, /#{purged_profile_id}/)
    expect(files.where(uploader_profile_id: purged_profile_id).count).to eq(2)
  end

  it "keeps the rows and raises when a key outside the prefix is not deleted" do
    allow(Storage).to receive(:delete_many).and_return(false)

    expect { use_case.call(profile_id: purged_profile_id) }.to raise_error(described_class::FileDeletionError, /#{purged_profile_id}/)
    expect(files.where(uploader_profile_id: purged_profile_id).count).to eq(2)
  end

  it "keeps the rows when Storage raises" do
    allow(Storage).to receive(:delete_prefix).and_raise("s3 down")

    expect { use_case.call(profile_id: purged_profile_id) }.to raise_error("s3 down")
    expect(files.where(uploader_profile_id: purged_profile_id).count).to eq(2)
  end

  context "with the local storage" do
    let(:uploads) { File.join("public", "uploads") }

    before do
      allow(Storage).to receive(:delete_prefix).and_call_original
      allow(Storage).to receive(:delete_many).and_call_original
      ["#{prefix}a.jpg", "#{prefix}a_thumb.jpg", "#{prefix}never_registered.jpg", "media/#{other_profile_id}/kept.jpg"].each do |key|
        FileUtils.mkdir_p(File.dirname(File.join(uploads, key)))
        File.write(File.join(uploads, key), "x")
      end
    end

    after do
      FileUtils.rm_rf(File.join(uploads, prefix))
      FileUtils.rm_rf(File.join(uploads, "media", other_profile_id))
    end

    it "removes uploads that were never registered together with the registered ones" do
      use_case.call(profile_id: purged_profile_id)

      expect(Dir.exist?(File.join(uploads, prefix)) ? Dir.children(File.join(uploads, prefix)) : []).to be_empty
      expect(File.exist?(File.join(uploads, "media", other_profile_id, "kept.jpg"))).to be(true)
    end
  end
end
