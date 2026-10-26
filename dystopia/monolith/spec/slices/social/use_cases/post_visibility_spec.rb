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

  it "decides a locked profile's posts by each post's visibility alone" do
    db[:profile__profiles].where(id: author).update(is_private: true)
    open = post_ref.new("p3", author, "public")
    secret = post_ref.new("p3s", author, "private")

    expect([follower, pending, stranger].map { |viewer| visible_to(viewer, open) }).to eq([true, true, true])
    expect([follower, pending, stranger].map { |viewer| visible_to(viewer, secret) }).to eq([true, false, false])
  end

  describe "when a block exists alongside an approved follow" do
    let(:blocks) { db[:social__blocks] }
    let(:post) { post_ref.new("p4", author, "private") }

    def insert_block(blocker, blocked)
      blocks.insert(id: SecureRandom.uuid_v7, blocker_profile_id: blocker, blocked_profile_id: blocked)
    end

    it "hides a followers-only post from the follower when the author blocks them" do
      insert_block(author, follower)

      expect(follow_repo.find(follower_profile_id: follower, followee_profile_id: author)).not_to be_nil
      expect(visible_to(follower, post)).to be false
      expect(can_see.call(viewer_profile_id: follower, post: post)).to be false
    end

    it "hides a followers-only post from the follower when they block the author" do
      insert_block(follower, author)

      expect(follow_repo.find(follower_profile_id: follower, followee_profile_id: author)).not_to be_nil
      expect(visible_to(follower, post)).to be false
      expect(can_see.call(viewer_profile_id: follower, post: post)).to be false
    end
  end

  it "treats a post reference without a visibility as public" do
    ref = Struct.new(:author_profile_id).new(author)

    expect(filter.call(viewer_profile_id: stranger, posts: [ref]).length).to eq(1)
  end

  describe "the display window" do
    let(:windowed_ref) { Struct.new(:id, :author_profile_id, :visibility, :published_at, :expires_at) }
    let(:now) { Time.now }

    it "shows scheduled and expired posts to the author only" do
      scheduled = windowed_ref.new("p5", author, "public", now + 60, nil)
      expired = windowed_ref.new("p6", author, "public", now - 120, now - 60)

      [scheduled, expired].each do |post|
        expect([author, follower, stranger, nil].map { |viewer| visible_to(viewer, post) }).to eq([true, false, false, false])
        expect(can_see.call(viewer_profile_id: follower, post: post)).to be false
      end
    end

    it "shows a live post with an end ahead under the usual rules" do
      post = windowed_ref.new("p7", author, "private", now - 60, now + 60)

      expect([author, follower, stranger].map { |viewer| visible_to(viewer, post) }).to eq([true, true, false])
    end

    it "hides a post from others once its end passes" do
      post = windowed_ref.new("p8", author, "public", now - 60, now + 60)
      expect(visible_to(stranger, post)).to be true

      allow(Time).to receive(:now).and_return(now + 60)

      expect([visible_to(stranger, post), visible_to(author, post)]).to eq([false, true])
    end
  end
end
