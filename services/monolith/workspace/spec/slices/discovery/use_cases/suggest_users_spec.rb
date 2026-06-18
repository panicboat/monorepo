# frozen_string_literal: true

require "spec_helper"

RSpec.describe Discovery::UseCases::SuggestUsers do
  subject(:use_case) { Discovery::Slice["use_cases.suggest_users"] }

  let(:users) { Identity::Slice["relations.users"] }
  let(:follows) { Social::Slice["relations.follows"] }
  let(:blocks) { Social::Slice["relations.blocks"] }
  let(:profile_repo) { Profile::Slice["repositories.profile_repository"] }

  # identity.users.role: 1 = guest, 2 = cast. Raw insert so we control the id
  # (profiles.account_id == users.id) and the role.
  def insert_user(role:)
    id = SecureRandom.uuid_v7
    users.dataset.insert(
      id: id,
      phone_number: "0#{rand(10**10)}",
      password_digest: "x",
      role: role,
      created_at: Time.now,
      updated_at: Time.now
    )
    id
  end

  # Creates a user + a profile. profile_repo.create relies on DB defaults for
  # sns_links / is_private (created_at defaults to now()).
  def make(role:, display_name:)
    id = insert_user(role: role)
    profile_repo.create(account_id: id, display_name: display_name, username: "u#{id.delete('-')[8, 20]}")
    id
  end

  it "returns the opposite role of the viewer (cast viewer → guests)" do
    viewer = insert_user(role: 2) # cast
    guest = make(role: 1, display_name: "G")
    other_cast = make(role: 2, display_name: "C")

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:account_id)

    expect(ids).to include(guest)
    expect(ids).not_to include(other_cast)
  end

  it "returns the opposite role of the viewer (guest viewer → casts)" do
    viewer = insert_user(role: 1) # guest
    cast = make(role: 2, display_name: "C")
    other_guest = make(role: 1, display_name: "G")

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:account_id)

    expect(ids).to include(cast)
    expect(ids).not_to include(other_guest)
  end

  it "excludes self, already-following, and bidirectionally-blocked accounts" do
    viewer = insert_user(role: 2) # cast
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

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:account_id)

    expect(ids).to include(visible)
    expect(ids).not_to include(followed)
    expect(ids).not_to include(blocked)
    expect(ids).not_to include(viewer)
  end

  it "orders newest-first" do
    viewer = insert_user(role: 2) # cast
    older = make(role: 1, display_name: "old")
    sleep 0.05
    newer = make(role: 1, display_name: "new")

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:account_id)

    expect(ids.index(newer)).to be < ids.index(older)
  end
end
