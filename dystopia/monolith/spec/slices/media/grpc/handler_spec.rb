# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "gruf"
require "lib/grpc/authenticatable"
require "slices/media/grpc/handler"
require "storage"
require "cgi"

RSpec.describe Media::Grpc::Handler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:uploader) { create_account_with_profile(role: 2, username: "media_uploader") }
  let(:other) { create_account_with_profile(username: "media_other") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = db[:profile__profiles].where(id: profile_id).get(:account_id)
    Current.profile_id = profile_id
  end

  let(:storage) do
    Class.new(Storage::LocalAdapter) do
      attr_reader :tagged
      attr_accessor :missing_keys

      def tag(key:, tags:)
        return false if (missing_keys || []).include?(key)

        (@tagged ||= {})[key] = tags
        true
      end
    end.new
  end

  before { Storage.adapter = storage }

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def register_as(media_type, media_id = SecureRandom.uuid_v7, media_key: key_for(Current.profile_id, media_id), thumbnail_key: "")
    rpc(:register_media, Media::V1::RegisterMediaRequest.new(
      media_id: media_id, media_key: media_key, media_type: media_type, filename: "a.png", content_type: "image/png", size_bytes: 10,
      thumbnail_key: thumbnail_key
    )).media
  end

  def register(media_id = SecureRandom.uuid_v7, **options)
    register_as(:MEDIA_TYPE_IMAGE, media_id, **options).id
  end

  def upload_url(filename = "a.png")
    rpc(:get_upload_url, Media::V1::GetUploadUrlRequest.new(filename: filename, content_type: "image/png", media_type: :MEDIA_TYPE_IMAGE))
  end

  def delete(media_id)
    rpc(:delete_media, Media::V1::DeleteMediaRequest.new(id: media_id)).success
  end

  after do
    Current.clear
    Storage.reset!
  end

  def key_for(profile_id, media_id, extension = ".png")
    "media/#{profile_id}/#{media_id}#{extension}"
  end

  it "records the acting profile as the uploader and its account as the owner of what it registers" do
    act_as(uploader)

    media_id = register

    row = db[:media__files].where(id: media_id).first
    expect(row[:uploader_profile_id]).to eq(uploader)
    expect(row[:owner_account_id]).to eq(Current.account_id)
  end

  it "stores what kind of file it is and hands the same kind back" do
    act_as(uploader)

    image = register_as(:MEDIA_TYPE_IMAGE)
    video = register_as(:MEDIA_TYPE_VIDEO)
    by_number = register_as(2)

    expect(db[:media__files].where(id: [image.id, video.id, by_number.id]).to_hash(:id, :media_type))
      .to eq(image.id => "image", video.id => "video", by_number.id => "video")
    expect([image.media_type, video.media_type, by_number.media_type]).to eq(%i[MEDIA_TYPE_IMAGE MEDIA_TYPE_VIDEO MEDIA_TYPE_VIDEO])
    expect(rpc(:get_media, Media::V1::GetMediaRequest.new(id: video.id)).media.media_type).to eq(:MEDIA_TYPE_VIDEO)
  end

  it "issues an upload key under the acting profile, without the account in it" do
    act_as(uploader)

    issued = upload_url("Photo.JPEG")

    expect(issued.media_key).to eq("media/#{uploader}/#{issued.media_id}.jpeg")
    expect(issued.media_key).not_to include(Current.account_id)
    expect(issued.upload_url).to include(CGI.escape(issued.media_key))
  end

  it "drops an extension that is not plain letters and digits from the key" do
    act_as(uploader)

    keys = ["photo.p ng", "photo.#{'x' * 11}", "photo.p%2Fg"].map { |filename| upload_url(filename) }

    expect(keys.map(&:media_key)).to eq(keys.map { |issued| "media/#{uploader}/#{issued.media_id}" })
  end

  it "tags the stored object with the owning account, which the key does not show" do
    act_as(uploader)
    media_id = SecureRandom.uuid_v7

    register(media_id)

    expect(storage.tagged).to eq(key_for(uploader, media_id) => { "owner-account-id" => Current.account_id })
  end

  it "registers only a key issued to the acting profile for that media id" do
    act_as(uploader)
    media_id = SecureRandom.uuid_v7
    refused = [
      key_for(other, media_id),
      key_for(uploader, SecureRandom.uuid_v7),
      "media/image/#{media_id}.png",
      "media/#{uploader}/../#{other}/#{media_id}.png",
      "#{key_for(uploader, media_id)}/extra",
      key_for(uploader, media_id, ".p ng")
    ]

    refused.each do |media_key|
      expect { register(media_id, media_key: media_key) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
    expect(db[:media__files].count).to eq(0)
    expect(storage.tagged).to be_nil
    expect(register(media_id, media_key: key_for(uploader, media_id, ""))).to eq(media_id)
  end

  it "accepts a thumbnail only from the acting profile's own keys, so deleting a file cannot remove another profile's object" do
    act_as(other)
    victim_id = register
    victim_key = key_for(other, victim_id)
    act_as(uploader)
    refused = [victim_key, "media/image/#{victim_id}.png", "media/#{uploader}/../#{other}/#{victim_id}.png", "anything"]

    refused.each do |thumbnail_key|
      expect { register(thumbnail_key: thumbnail_key) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
    expect(db[:media__files].where(uploader_profile_id: uploader).count).to eq(0)

    own_thumbnail = key_for(uploader, SecureRandom.uuid_v7, ".jpg")
    media_id = register(thumbnail_key: own_thumbnail)
    expect(db[:media__files].where(id: media_id).get(:thumbnail_key)).to eq(own_thumbnail)
  end

  it "refuses to register a file that was never uploaded" do
    act_as(uploader)
    media_id = SecureRandom.uuid_v7
    storage.missing_keys = [key_for(uploader, media_id)]

    expect { register(media_id) }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    expect(db[:media__files].count).to eq(0)
  end

  it "does not hand the owning account to anyone who reads the file" do
    act_as(uploader)
    account_id = Current.account_id
    media_id = register
    act_as(other)

    answer = rpc(:get_media, Media::V1::GetMediaRequest.new(id: media_id))

    expect(answer.to_json).not_to include(account_id)
  end

  it "lets the uploader delete its media file" do
    act_as(uploader)
    media_id = register

    expect(delete(media_id)).to be true
    expect(db[:media__files].where(id: media_id).count).to eq(0)
  end

  it "does not let another profile delete it, and answers as for a file that does not exist" do
    act_as(uploader)
    media_id = register

    act_as(other)

    expect(delete(media_id)).to be false
    expect(delete(SecureRandom.uuid_v7)).to be false
    expect(db[:media__files].where(id: media_id).count).to eq(1)
  end

  it "does not let anyone delete a file that has no recorded uploader" do
    media_id = SecureRandom.uuid_v7
    db[:media__files].insert(id: media_id, media_type: "image", media_key: "media/image/#{media_id}.png", created_at: Time.now)
    act_as(other)

    expect(delete(media_id)).to be false
    expect(db[:media__files].where(id: media_id).count).to eq(1)
  end

  it "refuses to upload, register or delete without an acting profile" do
    Current.account_id = SecureRandom.uuid_v7

    expect {
      rpc(:get_upload_url, Media::V1::GetUploadUrlRequest.new(filename: "a.png", content_type: "image/png", media_type: :MEDIA_TYPE_IMAGE))
    }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    expect { register(media_key: "media/x/y.png") }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    expect { delete(SecureRandom.uuid_v7) }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    expect(db[:media__files].count).to eq(0)
  end

  it "refuses every request that comes without an account" do
    act_as(uploader)
    media_id = register
    Current.clear
    unauthenticated = GRPC::Core::StatusCodes::UNAUTHENTICATED

    expect { rpc(:get_media, Media::V1::GetMediaRequest.new(id: media_id)) }.to status(unauthenticated)
    expect { rpc(:get_media_batch, Media::V1::GetMediaBatchRequest.new(ids: [media_id])) }.to status(unauthenticated)
    expect { rpc(:get_upload_url, Media::V1::GetUploadUrlRequest.new(filename: "a.png", content_type: "image/png", media_type: :MEDIA_TYPE_IMAGE)) }.to status(unauthenticated)
    expect { register(media_key: "media/x/y.png") }.to status(unauthenticated)
    expect { delete(media_id) }.to status(unauthenticated)
    expect(db[:media__files].where(id: media_id).count).to eq(1)
  end

  it "serves a media file to any signed-in account" do
    act_as(uploader)
    media_id = register
    Current.clear
    Current.account_id = SecureRandom.uuid_v7

    expect(rpc(:get_media, Media::V1::GetMediaRequest.new(id: media_id)).media.id).to eq(media_id)
    expect(rpc(:get_media_batch, Media::V1::GetMediaBatchRequest.new(ids: [media_id])).media.map(&:id)).to eq([media_id])
  end

  it "has what a profile uploaded removed when that profile is purged, and nothing else" do
    act_as(other)
    kept = register
    act_as(uploader)
    removed = register

    Media::Slice["use_cases.purge_profile"].call(profile_id: uploader)

    expect(db[:media__files].select_map(:id)).to eq([kept])
    expect(removed).not_to eq(kept)
  end
end
