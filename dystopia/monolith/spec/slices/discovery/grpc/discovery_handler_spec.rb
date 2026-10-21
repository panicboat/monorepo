# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/discovery/grpc/discovery_handler"

RSpec.describe Discovery::Grpc::DiscoveryHandler, type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }

  let!(:viewer) { create_account_with_profile(username: "discovery_viewer") }
  let!(:other_guest) { create_account_with_profile(username: "discovery_other_guest") }
  let!(:public_cast) { create_account_with_profile(role: 2, username: "discovery_public") }
  let!(:private_cast) { create_account_with_profile(role: 2, username: "discovery_private", is_private: true) }
  let!(:public_post) { post_repo.create_post(author_profile_id: public_cast, content: "discovery public", visibility: "public") }
  let!(:private_post) { post_repo.create_post(author_profile_id: private_cast, content: "discovery private", visibility: "public") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def suggested
    rpc(:suggest_users, Discovery::V1::SuggestUsersRequest.new).profiles.map { |p| [p.profile_id, p.role] }
  end

  def searched_post_ids
    rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: "discovery")).posts.map(&:id)
  end

  def ranked_post_ids
    rpc(:rank_posts, Discovery::V1::RankPostsRequest.new(period: :RANK_PERIOD_ALL)).posts.map(&:id)
  end

  after { Current.clear }

  it "suggests profiles of the opposite role, without the ones the acting profile follows or is blocked with" do
    act_as(viewer)
    expect(suggested).to contain_exactly([public_cast, 2], [private_cast, 2])

    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
    block_repo.block(blocker_profile_id: private_cast, blocked_profile_id: viewer)
    expect(suggested).to be_empty

    act_as(public_cast)
    expect(suggested).to contain_exactly([viewer, 1], [other_guest, 1])
  end

  it "searches by tag when the query starts with a number sign, and by content otherwise" do
    tagged = post_repo.create_post(author_profile_id: public_cast, content: "new arrivals #spring", visibility: "public")
    post_repo.save_hashtags(post_id: tagged.id, hashtags: ["spring"])
    longer = post_repo.create_post(author_profile_id: public_cast, content: "sale #springsale", visibility: "public")
    post_repo.save_hashtags(post_id: longer.id, hashtags: ["springsale"])
    search = ->(query) { rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: query)).posts.map(&:id) }

    act_as(viewer)

    expect(search.call("#spring")).to eq([tagged.id])
    expect(search.call("＃Spring")).to eq([tagged.id])
    expect(search.call("spring")).to contain_exactly(tagged.id, longer.id)
    expect(rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: "#spring")).posts.first.hashtags).to eq(["spring"])
  end

  it "pages search results by the display start" do
    now = Time.now
    started = post_repo.create_post(author_profile_id: public_cast, content: "paged started", visibility: "public", published_at: now - 60, created_at: now - 86_400)
    older = Array.new(2) { |i| post_repo.create_post(author_profile_id: public_cast, content: "paged older", visibility: "public", published_at: now - (3600 * (i + 1))) }
    act_as(viewer)

    first = rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: "paged", limit: 2))
    second = rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: "paged", limit: 2, cursor: first.next_cursor))

    expect(first.posts.map(&:id) + second.posts.map(&:id)).to eq([started.id, *older.map(&:id)])
    expect(second.has_more).to be(false)
  end

  it "searches and ranks posts as the acting profile is allowed to see them" do
    act_as(viewer)
    expect(searched_post_ids).to eq([public_post.id])
    expect(ranked_post_ids).to eq([public_post.id])

    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: private_cast, status: "approved")
    expect(searched_post_ids).to contain_exactly(public_post.id, private_post.id)
    expect(ranked_post_ids).to contain_exactly(public_post.id, private_post.id)

    act_as(other_guest)
    expect(searched_post_ids).to eq([public_post.id])
    expect(ranked_post_ids).to eq([public_post.id])
  end

  it "keeps followers-only posts out of search and ranking, even for an approved follower" do
    post_repo.create_post(author_profile_id: public_cast, content: "discovery followers", visibility: "private")
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
    act_as(viewer)

    expect(searched_post_ids).to eq([public_post.id])
    expect(ranked_post_ids).to eq([public_post.id])
  end

  it "keeps scheduled and expired posts out of search and ranking" do
    now = Time.now
    post_repo.create_post(author_profile_id: public_cast, content: "discovery scheduled", visibility: "public", published_at: now + 3600)
    post_repo.create_post(author_profile_id: public_cast, content: "discovery expired", visibility: "public", published_at: now - 7200, expires_at: now - 3600)
    act_as(public_cast)

    expect(searched_post_ids).to eq([public_post.id])
    expect(ranked_post_ids).to eq([public_post.id])
  end

  it "returns each found profile with the role of its account" do
    act_as(viewer)

    found = rpc(:search_users, Discovery::V1::SearchUsersRequest.new(query: "discovery_p")).profiles

    expect(found.map { |p| [p.username, p.role] }).to contain_exactly(["discovery_public", 2], ["discovery_private", 2])
    expect(found).to all(be_a(::Profile::V1::ProfileSummary))
  end

  it "returns the avatar url of a found profile that has an icon" do
    media_id = SecureRandom.uuid_v7
    db = Hanami.app["db.gateway"].connection
    db[:profile__profiles].where(id: public_cast).update(avatar_media_id: media_id)
    file = Struct.new(:id, :url, :thumbnail_url, :media_type, :media_key, :thumbnail_key).new(media_id, "https://cdn.example/a.png", nil, "image", "k", nil)
    allow_any_instance_of(Media::UseCases::GetMediaBatch).to receive(:call).and_return([file])
    act_as(viewer)

    found = rpc(:search_users, Discovery::V1::SearchUsersRequest.new(query: "discovery_public")).profiles

    expect(found.map(&:avatar_url)).to eq(["https://cdn.example/a.png"])
  end
end
