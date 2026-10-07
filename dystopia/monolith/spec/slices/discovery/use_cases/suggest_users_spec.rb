# frozen_string_literal: true

require "spec_helper"

RSpec.describe Discovery::UseCases::SuggestUsers do
  subject(:use_case) { Discovery::Slice["use_cases.suggest_users"] }

  let(:follows) { Social::Slice["relations.follows"] }
  let(:blocks) { Social::Slice["relations.blocks"] }

  def make(role:, display_name:)
    create_account_with_profile(role: role, display_name: display_name, username: "u#{SecureRandom.hex(10)}")
  end

  it "returns the opposite role of the viewer (cast viewer → guests)" do
    viewer = create_account_with_profile(role: 2)
    guest = make(role: 1, display_name: "G")
    other_cast = make(role: 2, display_name: "C")

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:id)

    expect(ids).to include(guest)
    expect(ids).not_to include(other_cast)
  end

  it "returns the opposite role of the viewer (guest viewer → casts)" do
    viewer = create_account_with_profile(role: 1)
    cast = make(role: 2, display_name: "C")
    other_guest = make(role: 1, display_name: "G")

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:id)

    expect(ids).to include(cast)
    expect(ids).not_to include(other_guest)
  end

  it "excludes self, already-following, and bidirectionally-blocked accounts" do
    viewer = create_account_with_profile(role: 2)
    followed = make(role: 1, display_name: "F")
    blocked = make(role: 1, display_name: "B")
    visible = make(role: 1, display_name: "V")

    follows.dataset.insert(
      id: SecureRandom.uuid_v7,
      follower_id: viewer, followee_id: followed, status: "approved",
      created_at: Time.now, updated_at: Time.now
    )
    blocks.dataset.insert(
      id: SecureRandom.uuid_v7,
      blocker_id: blocked, blocked_id: viewer, created_at: Time.now
    )

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:id)

    expect(ids).to include(visible)
    expect(ids).not_to include(followed)
    expect(ids).not_to include(blocked)
    expect(ids).not_to include(viewer)
  end

  it "orders newest-first" do
    viewer = create_account_with_profile(role: 2)
    older = make(role: 1, display_name: "old")
    sleep 0.05
    newer = make(role: 1, display_name: "new")

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:id)

    expect(ids.index(newer)).to be < ids.index(older)
  end
end
