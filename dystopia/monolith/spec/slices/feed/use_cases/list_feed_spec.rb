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

  it "leaves a pending follower's following feed without followers-only posts" do
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: author, status: "pending")
    post_repo.create_post(author_profile_id: author, content: "followers", visibility: "private")

    expect(uc.call(filter: "following", viewer_profile_id: viewer)[:post_ids]).to eq([])
  end
end
