# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Feed::UseCases::ListFeed", type: :database do
  let(:uc) { Feed::UseCases::ListFeed.new }
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:author) { create_account_with_profile(role: 2, username: "author") }
  let(:viewer) { create_account_with_profile(username: "viewer") }

  it "puts followers-only posts in the following feed and keeps them out of the all feed" do
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: author, status: "approved")
    secret = post_repo.create_post(author_profile_id: author, content: "followers", visibility: "private")
    open = post_repo.create_post(author_profile_id: author, content: "everyone", visibility: "public")

    following = uc.call(filter: "following", viewer_profile_id: viewer)[:post_ids]
    all = uc.call(filter: "all", viewer_profile_id: viewer)[:post_ids]

    expect(following).to contain_exactly(secret.id.to_s, open.id.to_s)
    expect(all).to eq([open.id.to_s])
  end

  it "keeps followers-only posts out of the area feed for an approved follower" do
    nearby_author = create_account_with_profile(role: 2, username: "area_author", prefecture: "東京都")
    nearby_viewer = create_account_with_profile(username: "area_viewer", prefecture: "東京都")
    follow_repo.follow(follower_profile_id: nearby_viewer, followee_profile_id: nearby_author, status: "approved")
    post_repo.create_post(author_profile_id: nearby_author, content: "followers", visibility: "private")
    open = post_repo.create_post(author_profile_id: nearby_author, content: "everyone", visibility: "public")

    area = uc.call(filter: "area", viewer_profile_id: nearby_viewer, prefecture: "東京都")[:post_ids]

    expect(area).to eq([open.id.to_s])
  end

  it "shows the viewer's own followers-only posts wherever their public posts appear" do
    own = create_account_with_profile(role: 2, username: "own_author", prefecture: "東京都")
    secret = post_repo.create_post(author_profile_id: own, content: "followers", visibility: "private")
    open = post_repo.create_post(author_profile_id: own, content: "everyone", visibility: "public")

    all = uc.call(filter: "all", viewer_profile_id: own)[:post_ids]
    area = uc.call(filter: "area", viewer_profile_id: own, prefecture: "東京都")[:post_ids]
    following = uc.call(filter: "following", viewer_profile_id: own)[:post_ids]

    expect([all, area]).to all(contain_exactly(secret.id.to_s, open.id.to_s))
    expect(following).to eq([])
  end

  it "keeps another author's followers-only posts out of the all feed while showing the viewer's own" do
    own_secret = post_repo.create_post(author_profile_id: viewer, content: "mine", visibility: "private")
    post_repo.create_post(author_profile_id: author, content: "theirs", visibility: "private")

    expect(uc.call(filter: "all", viewer_profile_id: viewer)[:post_ids]).to eq([own_secret.id.to_s])
  end

  it "leaves a pending follower's following feed without followers-only posts" do
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: author, status: "pending")
    post_repo.create_post(author_profile_id: author, content: "followers", visibility: "private")

    expect(uc.call(filter: "following", viewer_profile_id: viewer)[:post_ids]).to eq([])
  end

  describe "the followers feed" do
    let(:block_repo) { Social::Slice["repositories.block_repository"] }
    let(:fan) { create_account_with_profile(username: "fan") }
    let(:friend) { create_account_with_profile(username: "friend") }
    let(:idol) { create_account_with_profile(role: 2, username: "idol") }
    let(:asker) { create_account_with_profile(username: "asker") }

    def followers_feed = uc.call(filter: "followers", viewer_profile_id: viewer)[:post_ids]

    it "lists the public posts of approved followers only" do
      follow_repo.follow(follower_profile_id: fan, followee_profile_id: viewer, status: "approved")
      follow_repo.follow(follower_profile_id: asker, followee_profile_id: viewer, status: "pending")
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: idol, status: "approved")
      fan_post = post_repo.create_post(author_profile_id: fan, content: "fan", visibility: "public")
      post_repo.create_post(author_profile_id: asker, content: "asker", visibility: "public")
      post_repo.create_post(author_profile_id: idol, content: "idol", visibility: "public")

      expect(followers_feed).to eq([fan_post.id.to_s])
    end

    it "shows followers-only posts only from followers the viewer follows back" do
      follow_repo.follow(follower_profile_id: fan, followee_profile_id: viewer, status: "approved")
      follow_repo.follow(follower_profile_id: friend, followee_profile_id: viewer, status: "approved")
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: friend, status: "approved")
      post_repo.create_post(author_profile_id: fan, content: "fan secret", visibility: "private")
      friend_secret = post_repo.create_post(author_profile_id: friend, content: "friend secret", visibility: "private")

      expect(followers_feed).to eq([friend_secret.id.to_s])
    end

    it "shows a locked follower only when the viewer follows them back" do
      locked_fan = create_account_with_profile(username: "locked_fan", is_private: true)
      locked_friend = create_account_with_profile(username: "locked_friend", is_private: true)
      [locked_fan, locked_friend].each { |id| follow_repo.follow(follower_profile_id: id, followee_profile_id: viewer, status: "approved") }
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: locked_friend, status: "approved")
      post_repo.create_post(author_profile_id: locked_fan, content: "hidden", visibility: "public")
      shown = post_repo.create_post(author_profile_id: locked_friend, content: "shown", visibility: "public")

      expect(followers_feed).to eq([shown.id.to_s])
    end

    it "leaves out a follower blocked in either direction" do
      follow_repo.follow(follower_profile_id: fan, followee_profile_id: viewer, status: "approved")
      post_repo.create_post(author_profile_id: fan, content: "fan", visibility: "public")
      Hanami.app["db.gateway"].connection[:social__blocks].insert(id: SecureRandom.uuid_v7, blocker_profile_id: viewer, blocked_profile_id: fan)

      expect(followers_feed).to eq([])
    end
  end
end
