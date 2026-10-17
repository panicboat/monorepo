# frozen_string_literal: true

require "spec_helper"

RSpec.describe "post visibility in social", type: :database do
  let(:filter) { Social::Slice["use_cases.filter_visible_posts"] }
  let(:can_see) { Social::Slice["use_cases.viewer_can_see_post"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:author) { create_account_with_profile(role: 2, username: "author") }
  let(:follower) { create_account_with_profile(username: "follower") }
  let(:pending) { create_account_with_profile(username: "pending") }
  let(:stranger) { create_account_with_profile(username: "stranger") }
  let(:post_ref) { Struct.new(:id, :author_profile_id, :visibility) }

  before do
    follow_repo.follow(follower_profile_id: follower, followee_profile_id: author, status: "approved")
    follow_repo.follow(follower_profile_id: pending, followee_profile_id: author, status: "pending")
  end

  def visible_to(viewer, post) = filter.call(viewer_profile_id: viewer, posts: [post]).any?

  it "shows a public post on a public profile to everyone" do
    post = post_ref.new("p1", author, "public")

    expect([visible_to(stranger, post), visible_to(nil, post), can_see.call(viewer_profile_id: stranger, post: post)]).to eq([true, true, true])
  end

  it "shows a followers-only post to the author and approved followers only" do
    post = post_ref.new("p2", author, "private")

    expect([author, follower, pending, stranger, nil].map { |viewer| visible_to(viewer, post) }).to eq([true, true, false, false, false])
    expect([author, follower, pending, stranger].map { |viewer| can_see.call(viewer_profile_id: viewer, post: post) }).to eq([true, true, false, false])
  end

  it "keeps a private profile's public posts to approved followers" do
    db[:profile__profiles].where(id: author).update(is_private: true)
    post = post_ref.new("p3", author, "public")

    expect([follower, stranger].map { |viewer| visible_to(viewer, post) }).to eq([true, false])
  end

  it "hides a followers-only post from a follower when either side blocks" do
    block_repo.block(blocker_profile_id: author, blocked_profile_id: follower)
    post = post_ref.new("p4", author, "private")

    expect(visible_to(follower, post)).to be false
    expect(can_see.call(viewer_profile_id: follower, post: post)).to be false
  end

  it "treats a post reference without a visibility as public" do
    ref = Struct.new(:author_profile_id).new(author)

    expect(filter.call(viewer_profile_id: stranger, posts: [ref]).length).to eq(1)
  end
end
