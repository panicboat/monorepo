# frozen_string_literal: true

require "spec_helper"
require "post/v1/post_service_pb"

RSpec.describe Discovery::UseCases::RankPosts, type: :database do
  subject(:use_case) { Discovery::Slice["use_cases.rank_posts"] }

  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:like_repo) { Post::Slice["repositories.like_repository"] }
  let(:viewer) { create_account_with_profile(username: "rank_viewer") }
  let(:author) { create_account_with_profile(role: 2, username: "rank_author") }

  def ranked_post(likes, author_profile_id: author)
    post_repo.create_post(author_profile_id: author_profile_id, content: "#{likes} likes", visibility: "public").tap do |post|
      likes.times { like_repo.profile_like(post_id: post.id, profile_id: SecureRandom.uuid_v7) }
    end
  end

  def walk(limit:)
    pages = []
    cursor = nil
    10.times do
      page = use_case.call(period: "all", viewer_profile_id: viewer, limit: limit, cursor: cursor)
      pages << page
      break unless page[:has_more]

      cursor = page[:next_cursor]
    end
    pages
  end

  it "continues from the previous page in order of likes without repeating a post" do
    posts = [3, 2, 1].map { |likes| ranked_post(likes) }

    pages = walk(limit: 1)

    expect(pages.flat_map { |page| page[:posts].map(&:id) }).to eq(posts.map(&:id))
  end

  it "fills each page with posts the viewer can see and keeps the others out of the cursor" do
    blocking_author = create_account_with_profile(role: 2, username: "rank_blocking_author")
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: blocking_author, blocked_profile_id: viewer)
    top = ranked_post(4)
    hidden = ranked_post(3, author_profile_id: blocking_author)
    middle = ranked_post(2)
    bottom = ranked_post(1)

    pages = walk(limit: 1)
    cursors = pages.filter_map { |page| page[:next_cursor] }.map { |cursor| JSON.parse(Base64.urlsafe_decode64(cursor)) }

    expect(pages.map { |page| page[:posts].map(&:id) }).to eq([[top.id], [middle.id], [bottom.id]])
    expect(cursors.map { |cursor| cursor["id"] }).not_to include(hidden.id)
    expect(cursors.map { |cursor| cursor["likes"] }).not_to include(3)
  end
end
