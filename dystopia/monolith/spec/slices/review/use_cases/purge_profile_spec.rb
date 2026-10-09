# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Review::UseCases::PurgeProfile", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:use_case) { Review::Slice["use_cases.purge_profile"] }
  let(:entry_repo) { Review::Slice["repositories.entry_repository"] }
  let(:cast_settings_repo) { Review::Slice["repositories.cast_settings_repository"] }

  let(:purged) { SecureRandom.uuid_v7 }
  let(:cast) { SecureRandom.uuid_v7 }
  let(:guest) { SecureRandom.uuid_v7 }

  it "deletes the reviews the profile wrote or received and its setting, and leaves other profiles' rows" do
    entry_repo.create(author_profile_id: purged, target_profile_id: cast, rating: 4.0, body: "written")
    entry_repo.create(author_profile_id: guest, target_profile_id: purged, rating: 3.0, body: "received")
    kept = entry_repo.create(author_profile_id: guest, target_profile_id: cast, rating: 5.0, body: "kept")
    cast_settings_repo.upsert(profile_id: purged, reviews_visible: false)
    cast_settings_repo.upsert(profile_id: cast, reviews_visible: false)

    expect(use_case.call(profile_id: purged)).to be_nil

    expect(db[:review__entries].select_map(:id)).to eq([kept.id])
    expect(db[:review__cast_settings].select_map(:profile_id)).to eq([cast])
  end
end
