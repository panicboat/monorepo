# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"
require "slices/post/grpc/like_handler"
require "slices/post/grpc/comment_handler"
require "slices/bookmarks/grpc/bookmark_handler"

RSpec.describe "post display window", type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:like_repo) { Post::Slice["repositories.like_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:author) { create_account_with_profile(role: 2, username: "window_author") }
  let(:follower) { create_account_with_profile(username: "window_follower") }
  let(:now) { Time.now }
  let!(:live) { post_repo.create_post(author_profile_id: author, content: "live", visibility: "public", published_at: now - 3600) }
  let!(:scheduled) { post_repo.create_post(author_profile_id: author, content: "scheduled", visibility: "public", published_at: now + 3600) }
  let!(:expired) { post_repo.create_post(author_profile_id: author, content: "expired", visibility: "public", published_at: now - 7200, expires_at: now - 3600) }

  before { follow_repo.follow(follower_profile_id: follower, followee_profile_id: author, status: "approved") }

  after { Current.clear }

  def rpc(handler_class, method, message)
    handler_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def profile_post_ids
    rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: author)).posts.map(&:id)
  end

  def get_post(id)
    rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: id)).post
  end

  def expect_not_found(&block)
    expect(&block).to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND) }
  end

  describe "the profile list" do
    it "shows the author their scheduled and expired posts" do
      act_as(author)

      expect(profile_post_ids).to contain_exactly(live.id, scheduled.id, expired.id)
    end

    it "shows other viewers only the live posts" do
      act_as(follower)
      expect(profile_post_ids).to eq([live.id])

      Current.clear
      expect(profile_post_ids).to eq([live.id])
    end

    it "orders by the display start and pages through posts that share it without gaps or repeats" do
      shared = now - 60
      tied = Array.new(3) { |i| post_repo.create_post(author_profile_id: author, content: "tied #{i}", visibility: "public", published_at: shared) }
      newest = post_repo.create_post(author_profile_id: author, content: "newest", visibility: "public", published_at: now - 30, created_at: now - 86_400)
      act_as(follower)

      ids = []
      cursor = ""
      loop do
        response = rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: author, limit: 2, cursor: cursor))
        ids.concat(response.posts.map(&:id))
        break unless response.has_more

        cursor = response.next_cursor
      end

      expect(ids).to eq([newest.id, *tied.map(&:id).sort.reverse, live.id])
    end
  end

  describe "the post detail" do
    it "opens scheduled and expired posts for the author" do
      act_as(author)

      expect([scheduled.id, expired.id].map { |id| get_post(id).id }).to eq([scheduled.id, expired.id])
    end

    it "treats scheduled and expired posts as not found for everyone else" do
      act_as(follower)

      [scheduled.id, expired.id].each { |id| expect_not_found { get_post(id) } }
    end

    it "hides a post from others on the first read after its display end passes" do
      ending = post_repo.create_post(author_profile_id: author, content: "ending", visibility: "public", published_at: now - 60, expires_at: now + 60)
      act_as(follower)
      expect(get_post(ending.id).id).to eq(ending.id)
      expect(profile_post_ids).to include(ending.id)

      allow(Time).to receive(:now).and_return(now + 61)

      expect_not_found { get_post(ending.id) }
      expect(profile_post_ids).not_to include(ending.id)
    end

    it "returns the display window" do
      act_as(author)

      presented = get_post(expired.id)

      expect(Time.iso8601(presented.published_at).to_i).to eq((now - 7200).to_i)
      expect(Time.iso8601(presented.expires_at).to_i).to eq((now - 3600).to_i)
      expect(get_post(live.id).expires_at).to eq("")
    end
  end

  describe "acting on a post outside its window" do
    it "does not let others like, comment on or bookmark a scheduled post" do
      act_as(follower)

      expect_not_found { rpc(Post::Grpc::LikeHandler, :like_post, Post::V1::LikePostRequest.new(post_id: scheduled.id)) }
      expect_not_found { rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: scheduled.id, content: "early")) }
      expect_not_found { rpc(Bookmarks::Grpc::BookmarkHandler, :bookmark, Bookmarks::V1::BookmarkRequest.new(post_id: scheduled.id)) }
      expect(like_repo.likes_count(post_id: scheduled.id)).to eq(0)
    end

    it "keeps an expired post out of the viewer's bookmarks and likes" do
      act_as(follower)
      rpc(Bookmarks::Grpc::BookmarkHandler, :bookmark, Bookmarks::V1::BookmarkRequest.new(post_id: live.id))
      like_repo.profile_like(post_id: live.id, profile_id: follower)
      post_repo.update_post(live.id, expires_at: now - 1)

      bookmarks = rpc(Bookmarks::Grpc::BookmarkHandler, :list_bookmarks, Bookmarks::V1::ListBookmarksRequest.new).items.filter_map(&:post)
      likes = rpc(Post::Grpc::LikeHandler, :list_liked_posts_by_profile, Post::V1::ListLikedPostsByProfileRequest.new(profile_id: follower)).posts

      expect([bookmarks, likes]).to eq([[], []])
    end
  end
end
