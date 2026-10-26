# frozen_string_literal: true

require "spec_helper"

RSpec.describe Media::UseCases::SelectOwnedMediaIds, type: :database do
  let(:use_case) { described_class.new }
  let(:files) { Hanami.app["db.gateway"].connection[:media__files] }
  let(:owner) { SecureRandom.uuid_v7 }

  def insert_file(profile_id:)
    SecureRandom.uuid_v7.tap do |id|
      files.insert(id: id, media_type: "image", media_key: "media/#{profile_id}/#{id}.jpg", uploader_profile_id: profile_id)
    end
  end

  it "returns only the ids the profile uploaded" do
    own = insert_file(profile_id: owner)
    others = insert_file(profile_id: SecureRandom.uuid_v7)

    expect(use_case.call(profile_id: owner, ids: [own, others, SecureRandom.uuid_v7])).to eq([own])
  end

  it "returns nothing for no ids" do
    expect(use_case.call(profile_id: owner, ids: [])).to eq([])
  end
end
