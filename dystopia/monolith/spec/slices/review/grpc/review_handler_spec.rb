# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "gruf"
require "lib/grpc/authenticatable"
require "slices/review/grpc/review_handler"

RSpec.describe Review::Grpc::ReviewHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  let(:cast) { create_account_with_profile(role: 2, username: "review_cast") }
  let(:other_cast) { create_account_with_profile(role: 2, username: "review_other_cast") }
  let(:guest) { create_account_with_profile(username: "review_guest") }
  let(:reader) { create_account_with_profile(username: "review_reader") }

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

  def review(target)
    rpc(:create_entry, Review::V1::CreateEntryRequest.new(target_profile_id: target, rating: 4.5, body: "great")).entry
  end

  def by_target(profile_id)
    rpc(:list_entries_by_target, Review::V1::ListEntriesByTargetRequest.new(target_profile_id: profile_id)).entries
  end

  def by_author(profile_id)
    rpc(:list_entries_by_author, Review::V1::ListEntriesByAuthorRequest.new(author_profile_id: profile_id)).entries
  end

  def recent
    rpc(:list_recent_entries, Review::V1::ListRecentEntriesRequest.new).entries
  end

  def parties(entries)
    entries.map { |e| [e.author_profile_id, e.target_profile_id, e.author_username, e.target_username] }
  end

  def settings
    rpc(:get_my_settings, Review::V1::GetMySettingsRequest.new).reviews_visible
  end

  after { Current.clear }

  it "stores a review from the acting profile about the target profile" do
    act_as(guest)

    entry = review(cast)

    expect(parties([entry])).to eq([[guest, cast, "review_guest", "review_cast"]])
    expect(db[:review__entries].select_map([:author_profile_id, :target_profile_id])).to eq([[guest, cast]])
  end

  it "accepts a review only about a cast profile" do
    act_as(guest)

    expect { review(reader) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    expect(db[:review__entries].count).to eq(0)
  end

  it "rejects a review about another profile of the author's own account, and about the author itself" do
    owner = create_account(role: 2)
    persona = create_account_with_profile(account_id: owner, username: "review_persona")
    sibling = create_account_with_profile(account_id: owner, username: "review_sibling")
    Hanami.app.slices[:profile]["repositories.cast_repository"].create(profile_id: sibling)

    act_as(persona)

    expect { review(sibling) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    expect { review(persona) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    expect(review(cast).target_profile_id).to eq(cast)
    expect(db[:review__entries].count).to eq(1)
  end

  it "lists reviews by target, by author and in the recent list with both parties" do
    act_as(guest)
    review(cast)
    review(other_cast)
    act_as(reader)
    review(other_cast)
    about_cast = [guest, cast, "review_guest", "review_cast"]
    about_other_cast = [guest, other_cast, "review_guest", "review_other_cast"]
    by_reader = [reader, other_cast, "review_reader", "review_other_cast"]

    expect(parties(by_target(cast))).to eq([about_cast])
    expect(parties(by_target(other_cast))).to contain_exactly(about_other_cast, by_reader)
    expect(parties(by_author(guest))).to contain_exactly(about_cast, about_other_cast)
    expect(parties(by_author(reader))).to eq([by_reader])
    expect(parties(recent)).to contain_exactly(about_cast, about_other_cast, by_reader)
  end

  it "lets only the author change a review and only the target hide it" do
    act_as(guest)
    id = review(cast).id

    act_as(reader)
    expect { rpc(:update_entry, Review::V1::UpdateEntryRequest.new(entry_id: id, rating: 1.0)) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    expect { rpc(:hide_entry, Review::V1::HideEntryRequest.new(entry_id: id)) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    expect { rpc(:delete_entry, Review::V1::DeleteEntryRequest.new(entry_id: id)) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)

    act_as(cast)
    expect { rpc(:update_entry, Review::V1::UpdateEntryRequest.new(entry_id: id, rating: 1.0)) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    expect(rpc(:hide_entry, Review::V1::HideEntryRequest.new(entry_id: id)).entry.hidden).to be true
    expect(by_target(cast).map(&:hidden)).to eq([true])

    act_as(reader)
    expect(by_target(cast)).to be_empty

    act_as(guest)
    expect { rpc(:unhide_entry, Review::V1::UnhideEntryRequest.new(entry_id: id)) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    updated = rpc(:update_entry, Review::V1::UpdateEntryRequest.new(entry_id: id, rating: 2.0)).entry
    expect([updated.rating, updated.author_profile_id, updated.target_profile_id]).to eq([2.0, guest, cast])
    rpc(:delete_entry, Review::V1::DeleteEntryRequest.new(entry_id: id))
    expect(db[:review__entries].count).to eq(0)
  end

  it "edits the rating and the body separately and clears the body when an empty one is sent" do
    act_as(guest)
    id = review(cast).id

    rated = rpc(:update_entry, Review::V1::UpdateEntryRequest.new(entry_id: id, rating: 3.0)).entry
    expect([rated.rating, rated.body]).to eq([3.0, "great"])

    reworded = rpc(:update_entry, Review::V1::UpdateEntryRequest.new(entry_id: id, body: "reworded")).entry
    expect([reworded.rating, reworded.body]).to eq([3.0, "reworded"])

    cleared = rpc(:update_entry, Review::V1::UpdateEntryRequest.new(entry_id: id, rating: 5.0, body: "")).entry
    expect([cleared.rating, cleared.body]).to eq([5.0, ""])
    expect(db[:review__entries].where(id: id).get(:body)).to be_nil
  end

  it "moves updated_at when the author edits a review and not when the cast hides it" do
    act_as(guest)
    id = review(cast).id
    updated_at = -> { db[:review__entries].where(id: id).get(:updated_at) }
    created_at = updated_at.call

    act_as(cast)
    rpc(:hide_entry, Review::V1::HideEntryRequest.new(entry_id: id))
    expect(updated_at.call).to eq(created_at)
    rpc(:unhide_entry, Review::V1::UnhideEntryRequest.new(entry_id: id))
    expect(updated_at.call).to eq(created_at)

    act_as(guest)
    rpc(:update_entry, Review::V1::UpdateEntryRequest.new(entry_id: id, body: "edited"))
    expect(updated_at.call).to be > created_at
  end

  it "stores review settings per cast profile and hides that cast's reviews from other profiles" do
    act_as(guest)
    review(cast)
    review(other_cast)

    act_as(cast)
    expect(settings).to be true
    expect(rpc(:update_my_settings, Review::V1::UpdateMySettingsRequest.new(reviews_visible: false)).reviews_visible).to be false
    expect(db[:review__cast_settings].select_map([:profile_id, :reviews_visible])).to eq([[cast, false]])
    expect(settings).to be false
    expect(by_target(cast).length).to eq(1)

    act_as(other_cast)
    expect(settings).to be true

    act_as(reader)
    expect(by_target(cast)).to be_empty
    expect(by_target(other_cast).map(&:author_profile_id)).to eq([guest])
    expect(recent.map(&:target_profile_id)).to eq([other_cast])
  end

  it "hides a review from a viewer who is blocked with the other party" do
    act_as(guest)
    review(cast)
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: guest, blocked_profile_id: reader)

    act_as(reader)

    expect(by_target(cast)).to be_empty
    expect(recent).to be_empty

    act_as(other_cast)
    expect(by_target(cast).map(&:author_profile_id)).to eq([guest])
  end
end
