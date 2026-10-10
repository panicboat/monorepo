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
    rpc(:suggest_users, Discovery::V1::SuggestUsersRequest.new).profiles.map { |p| [p.id, p.role] }
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

  it "returns each found profile with the role of its account" do
    act_as(viewer)

    found = rpc(:search_users, Discovery::V1::SearchUsersRequest.new(query: "discovery_p")).profiles

    expect(found.map { |p| [p.username, p.role] }).to contain_exactly(["discovery_public", 2], ["discovery_private", 2])
  end
end
