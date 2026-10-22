# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::UseCases::Follows::ListFollowing", type: :database do
  let(:list_following) { Social::Slice["use_cases.follows.list_following"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:viewer) { create_account_with_profile(username: "following_viewer") }
  let(:sakura) { create_account_with_profile(role: 2, username: "sakura_0412", display_name: "さくら") }
  let(:satomi) { create_account_with_profile(role: 2, username: "satomi_cast", display_name: "Satomi") }
  let(:hana) { create_account_with_profile(role: 2, username: "hana", display_name: "はな") }

  def follow(followee, status: "approved")
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: followee, status: status)
  end

  def listed_ids(**args)
    list_following.call(profile_id: viewer, **args)[:profiles].map(&:id)
  end

  it "lists every approved follow without a query" do
    [sakura, satomi, hana].each { |followee| follow(followee) }

    expect(listed_ids).to contain_exactly(sakura, satomi, hana)
    expect(listed_ids(query: "  ")).to contain_exactly(sakura, satomi, hana)
  end

  it "narrows the follows to profiles whose username or display name contains the query" do
    [sakura, satomi, hana].each { |followee| follow(followee) }

    expect(listed_ids(query: "SA")).to contain_exactly(sakura, satomi)
    expect(listed_ids(query: "さく")).to eq([sakura])
  end

  it "leaves out matching profiles the viewer does not follow, has only requested, or cannot see" do
    hidden = create_account_with_profile(role: 2, username: "sara_hidden")
    follow(sakura)
    follow(satomi, status: "pending")
    follow(hidden)
    create_account_with_profile(role: 2, username: "saki_stranger")
    db[:profile__profiles].where(id: hidden).update(disabled_at: Time.now)

    expect(listed_ids(query: "sa")).to eq([sakura])
  end

  it "pages through the narrowed follows" do
    [sakura, satomi, hana].each_with_index do |followee, index|
      follow(followee)
      db[:social__follows].where(follower_profile_id: viewer, followee_profile_id: followee).update(created_at: Time.utc(2026, 10, 1) + index)
    end

    first_page = list_following.call(profile_id: viewer, query: "sa", limit: 1)
    second_page = list_following.call(profile_id: viewer, query: "sa", limit: 1, cursor: first_page[:next_cursor])

    expect(first_page[:has_more]).to be(true)
    expect(second_page[:has_more]).to be(false)
    expect((first_page[:profiles] + second_page[:profiles]).map(&:id)).to contain_exactly(sakura, satomi)
  end
end
