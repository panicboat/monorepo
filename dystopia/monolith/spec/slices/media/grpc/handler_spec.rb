# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "gruf"
require "lib/grpc/authenticatable"
require "slices/media/grpc/handler"

RSpec.describe Media::Grpc::Handler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:uploader) { create_account_with_profile(role: 2, username: "media_uploader") }
  let(:other) { create_account_with_profile(username: "media_other") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def register(media_id = SecureRandom.uuid_v7)
    rpc(:register_media, Media::V1::RegisterMediaRequest.new(
      media_id: media_id, media_key: "media/image/#{media_id}.png", media_type: :MEDIA_TYPE_IMAGE, filename: "a.png", content_type: "image/png", size_bytes: 10
    )).media.id
  end

  def delete(media_id)
    rpc(:delete_media, Media::V1::DeleteMediaRequest.new(id: media_id)).success
  end

  after { Current.clear }

  it "records the acting profile as the uploader of what it registers" do
    act_as(uploader)

    media_id = register

    expect(db[:media__files].where(id: media_id).get(:uploader_profile_id)).to eq(uploader)
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
    expect { register }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
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
    expect { register }.to status(unauthenticated)
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
