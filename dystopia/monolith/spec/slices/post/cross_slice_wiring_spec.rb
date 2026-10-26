# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"
require "slices/post/grpc/like_handler"
require "slices/post/grpc/comment_handler"
require "slices/feed/grpc/handler"

RSpec.describe "Post slice wiring with the slices that read posts", type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:comment_repo) { Post::Slice["repositories.comment_repository"] }
  let(:like_repo) { Post::Slice["repositories.like_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:bookmark_repo) { Bookmarks::Slice["repositories.bookmark_repository"] }
  let(:list_posts) { Post::Slice["use_cases.posts.list_posts_by_ids"] }

  let(:viewer) { create_account_with_profile(username: "wiring_viewer") }
  let(:public_author) { create_account_with_profile(role: 2, username: "wiring_public") }
  let(:locked_author) { create_account_with_profile(role: 2, username: "wiring_locked", is_private: true) }
  let!(:public_post) { post_repo.create_post(author_profile_id: public_author, content: "wiring public", visibility: "public") }
  let!(:locked_post) { post_repo.create_post(author_profile_id: locked_author, content: "wiring locked", visibility: "public") }
  let!(:followers_post) { post_repo.create_post(author_profile_id: locked_author, content: "wiring followers", visibility: "private") }

  it "hydrates posts with the author profile and hides a followers-only post from a non-follower" do
    result = list_posts.call(post_ids: [public_post.id, locked_post.id, followers_post.id], viewer_profile_id: viewer)

    expect(result.keys).to contain_exactly(public_post.id, locked_post.id)
    expect(result[public_post.id].author_profile_id).to eq(public_author)
    expect(result[public_post.id].author.profile_id).to eq(public_author)
    expect(result[public_post.id].author.username).to eq("wiring_public")
    expect(result[public_post.id].author).to be_a(::Profile::V1::ProfileSummary)
    expect(result[public_post.id].author.is_private).to be false
  end

  it "shows a followers-only post to an approved follower and marks the viewer's like" do
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: locked_author, status: "approved")
    like_repo.profile_like(post_id: followers_post.id, profile_id: viewer)

    result = list_posts.call(post_ids: [public_post.id, followers_post.id], viewer_profile_id: viewer)

    expect(result.keys).to contain_exactly(public_post.id, followers_post.id)
    expect(result[followers_post.id].liked).to be true
    expect(result[public_post.id].liked).to be false
  end

  it "decides a single post's visibility from its visibility and the viewer's follow" do
    can_see = Social::Slice["use_cases.viewer_can_see_post"]

    expect(can_see.call(viewer_profile_id: viewer, post: post_repo.find_by_id(locked_post.id))).to be true
    expect(can_see.call(viewer_profile_id: viewer, post: post_repo.find_by_id(followers_post.id))).to be_falsy
    expect(can_see.call(viewer_profile_id: locked_author, post: post_repo.find_by_id(followers_post.id))).to be true

    follow_repo.follow(follower_profile_id: locked_author, followee_profile_id: viewer, status: "approved")
    expect(can_see.call(viewer_profile_id: viewer, post: post_repo.find_by_id(followers_post.id))).to be_falsy
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: locked_author, status: "approved")
    expect(can_see.call(viewer_profile_id: viewer, post: post_repo.find_by_id(followers_post.id))).to be true
  end

  it "lists the following feed by the followed author profiles" do
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_author, status: "approved")

    all = Feed::UseCases::ListFeed.new.call(filter: "all", viewer_profile_id: viewer)
    following = Feed::UseCases::ListFeed.new.call(filter: "following", viewer_profile_id: viewer)

    expect(all[:post_ids]).to contain_exactly(public_post.id, locked_post.id)
    expect(following[:post_ids]).to eq([public_post.id])
  end

  it "excludes posts from profiles blocked by the viewer" do
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: viewer, blocked_profile_id: public_author)

    result = Feed::UseCases::ListFeed.new.call(filter: "all", viewer_profile_id: viewer)

    expect(result[:post_ids]).not_to include(public_post.id)
  end

  it "excludes posts from profiles that blocked the viewer" do
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: public_author, blocked_profile_id: viewer)

    result = Feed::UseCases::ListFeed.new.call(filter: "all", viewer_profile_id: viewer)

    expect(result[:post_ids]).not_to include(public_post.id)
  end

  it "ranks and searches a locked author's public posts for a viewer" do
    [public_post, locked_post, followers_post].each { |post| like_repo.profile_like(post_id: post.id, profile_id: SecureRandom.uuid_v7) }
    ranked = Discovery::Slice["use_cases.rank_posts"].call(period: "all", viewer_profile_id: viewer)
    found = Discovery::Slice["use_cases.search_posts"].call(query: "wiring", viewer_profile_id: viewer)

    expect(ranked[:posts].map(&:id)).to contain_exactly(public_post.id, locked_post.id)
    expect(found[:posts].map(&:id)).to contain_exactly(public_post.id, locked_post.id)
  end

  it "lists bookmarked posts for a viewer" do
    bookmark_repo.bookmark(profile_id: viewer, post_id: public_post.id)

    result = Bookmarks::Slice["use_cases.list_bookmarks"].call(profile_id: viewer)

    expect(result[:posts].map(&:id)).to eq([public_post.id])
  end

  it "filters review author references through the post visibility filter" do
    refs = [public_author, locked_author].map { |id| Review::UseCases::FilterVisibleReviews::AuthorRef.new(id) }
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: locked_author, blocked_profile_id: viewer)

    visible = Social::Slice["use_cases.filter_visible_posts"].call(viewer_profile_id: viewer, posts: refs)

    expect(visible.map(&:author_profile_id)).to eq([public_author])
  end

  describe "RPC entry points" do
    def rpc(handler_class, method, message)
      handler_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
    end

    def act_as(profile_id)
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = profile_id
    end

    def status(code)
      raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
    end

    after { Current.clear }

    it "lists and gets posts by author profile" do
      act_as(viewer)

      listed = rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: public_author))
      got = rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: public_post.id))

      expect(listed.posts.map(&:id)).to eq([public_post.id])
      expect(listed.posts.first.author_profile_id).to eq(public_author)
      expect(got.post.author.profile_id).to eq(public_author)
      expect { rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: followers_post.id)) }
        .to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end

    it "returns the post author as a profile summary with its privacy" do
      act_as(locked_author)

      got = rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: locked_post.id))

      expect(got.post.author).to be_a(::Profile::V1::ProfileSummary)
      expect(got.post.author.is_private).to be true
    end

    it "returns the comment author as a profile summary with its privacy" do
      act_as(locked_author)
      added = rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: public_post.id, content: "hello"))
      listed = rpc(Post::Grpc::CommentHandler, :list_comments, Post::V1::ListCommentsRequest.new(post_id: public_post.id))

      expect(added.comment.author).to be_a(::Profile::V1::ProfileSummary)
      expect(added.comment.author.is_private).to be true
      expect(listed.comments.first.author.is_private).to be true
    end

    it "returns a private post only to its author" do
      act_as(public_author)
      saved = rpc(Post::Grpc::PostHandler, :save_post, Post::V1::SavePostRequest.new(content: "private wiring", visibility: "private"))
      authored = rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: saved.post.id))

      expect(authored.post.id).to eq(saved.post.id)

      act_as(viewer)
      expect { rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: saved.post.id)) }
        .to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end

    it "saves a post as the acting profile and lets only that profile delete it" do
      act_as(viewer)
      saved = rpc(Post::Grpc::PostHandler, :save_post, Post::V1::SavePostRequest.new(content: "mine", visibility: "public")).post

      act_as(public_author)
      expect { rpc(Post::Grpc::PostHandler, :delete_post, Post::V1::DeletePostRequest.new(id: saved.id)) }
        .to status(GRPC::Core::StatusCodes::NOT_FOUND)

      act_as(viewer)
      rpc(Post::Grpc::PostHandler, :delete_post, Post::V1::DeletePostRequest.new(id: saved.id))

      expect(saved.author_profile_id).to eq(viewer)
      expect(post_repo.find_by_id(saved.id)).to be_nil
    end

    it "likes, reports like status, lists liked posts for the acting profile only, and unlikes" do
      act_as(viewer)

      liked = rpc(Post::Grpc::LikeHandler, :like_post, Post::V1::LikePostRequest.new(post_id: public_post.id))
      status_map = rpc(Post::Grpc::LikeHandler, :get_like_status, Post::V1::GetLikeStatusRequest.new(post_ids: [public_post.id])).liked
      mine = rpc(Post::Grpc::LikeHandler, :list_liked_posts_by_profile, Post::V1::ListLikedPostsByProfileRequest.new(profile_id: viewer))

      expect(liked.likes_count).to eq(1)
      expect(status_map[public_post.id]).to be true
      expect(mine.posts.map(&:id)).to eq([public_post.id])
      expect {
        rpc(Post::Grpc::LikeHandler, :list_liked_posts_by_profile, Post::V1::ListLikedPostsByProfileRequest.new(profile_id: public_author))
      }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)

      like_repo.profile_like(post_id: public_post.id, profile_id: public_author)
      unliked = rpc(Post::Grpc::LikeHandler, :unlike_post, Post::V1::UnlikePostRequest.new(post_id: public_post.id))
      expect(unliked.likes_count).to eq(1)
    end

    it "drops a liked followers-only post from the liked list once the viewer unfollows" do
      secret = post_repo.create_post(author_profile_id: public_author, content: "followers", visibility: "private")
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_author, status: "approved")
      like_repo.profile_like(post_id: secret.id, profile_id: viewer)
      act_as(viewer)
      liked_ids = -> { rpc(Post::Grpc::LikeHandler, :list_liked_posts_by_profile, Post::V1::ListLikedPostsByProfileRequest.new(profile_id: viewer)).posts.map(&:id) }

      expect(liked_ids.call).to eq([secret.id])

      follow_repo.unfollow(follower_profile_id: viewer, followee_profile_id: public_author)
      expect(liked_ids.call).to eq([])
    end

    it "lets an approved follower like and comment on a followers-only post and refuses a non-follower" do
      secret = post_repo.create_post(author_profile_id: public_author, content: "followers", visibility: "private")
      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_author, status: "approved")
      outsider = create_account_with_profile(username: "wiring_outsider")

      act_as(viewer)
      liked = rpc(Post::Grpc::LikeHandler, :like_post, Post::V1::LikePostRequest.new(post_id: secret.id))
      added = rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: secret.id, content: "hello"))

      act_as(outsider)
      expect { rpc(Post::Grpc::LikeHandler, :like_post, Post::V1::LikePostRequest.new(post_id: secret.id)) }
        .to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect { rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: secret.id, content: "hello")) }
        .to status(GRPC::Core::StatusCodes::NOT_FOUND)

      expect(liked.likes_count).to eq(1)
      expect(added.comment.author_profile_id).to eq(viewer)
      expect(like_repo.likes_count(post_id: secret.id)).to eq(1)
      expect(comment_repo.comments_count(post_id: secret.id)).to eq(1)
    end

    it "rejects a reply whose parent comment belongs to another post" do
      other_post = post_repo.create_post(author_profile_id: public_author, content: "another post", visibility: "public")
      parent = comment_repo.create_comment(post_id: other_post.id, author_profile_id: public_author, content: "on the other post")
      act_as(viewer)

      expect {
        rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: public_post.id, content: "reply", parent_id: parent.id))
      }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect(comment_repo.list_replies(parent_id: parent.id)).to be_empty
    end

    it "adds, lists and deletes comments by author profile" do
      act_as(viewer)
      added = rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: public_post.id, content: "hello"))
      listed = rpc(Post::Grpc::CommentHandler, :list_comments, Post::V1::ListCommentsRequest.new(post_id: public_post.id))
      by_author = rpc(Post::Grpc::CommentHandler, :list_comments_by_author, Post::V1::ListCommentsByAuthorRequest.new(author_profile_id: viewer))

      expect(added.comment.author_profile_id).to eq(viewer)
      expect(added.comment.author.profile_id).to eq(viewer)
      expect(listed.comments.map(&:author_profile_id)).to eq([viewer])
      expect(by_author.comments.map(&:id)).to eq([added.comment.id])
      expect(by_author.posts_by_id[public_post.id].author_profile_id).to eq(public_author)

      act_as(public_author)
      expect {
        rpc(Post::Grpc::CommentHandler, :delete_comment, Post::V1::DeleteCommentRequest.new(comment_id: added.comment.id))
      }.to status(GRPC::Core::StatusCodes::NOT_FOUND)

      act_as(viewer)
      deleted = rpc(Post::Grpc::CommentHandler, :delete_comment, Post::V1::DeleteCommentRequest.new(comment_id: added.comment.id))
      expect(deleted.comments_count).to eq(0)
    end

    it "excludes a blocked profile's comments and replies" do
      blocked_profile = create_account_with_profile(username: "wiring_blocked")
      visible_comment = comment_repo.create_comment(post_id: public_post.id, author_profile_id: public_author, content: "visible")
      comment_repo.create_comment(post_id: public_post.id, author_profile_id: blocked_profile, content: "blocked")
      reply_parent = comment_repo.create_comment(post_id: public_post.id, author_profile_id: public_author, content: "reply parent")
      visible_reply = comment_repo.create_comment(post_id: public_post.id, author_profile_id: public_author, content: "visible reply", parent_id: reply_parent.id)
      comment_repo.create_comment(post_id: public_post.id, author_profile_id: blocked_profile, content: "blocked reply", parent_id: reply_parent.id)
      Social::Slice["repositories.block_repository"].block(blocker_profile_id: viewer, blocked_profile_id: blocked_profile)

      act_as(viewer)
      comments = rpc(Post::Grpc::CommentHandler, :list_comments, Post::V1::ListCommentsRequest.new(post_id: public_post.id))
      replies = rpc(Post::Grpc::CommentHandler, :list_replies, Post::V1::ListRepliesRequest.new(comment_id: reply_parent.id))

      expect(comments.comments.map(&:id)).to contain_exactly(visible_comment.id, reply_parent.id)
      expect(comments.comments.map(&:author_profile_id)).not_to include(blocked_profile)
      expect(replies.replies.map(&:id)).to contain_exactly(visible_reply.id)
      expect(replies.replies.map(&:author_profile_id)).not_to include(blocked_profile)
    end

    it "lists an author's posts only to viewers who may see them" do
      authored_by = ->(author) { rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: author)).posts.map(&:id) }

      act_as(viewer)
      expect(authored_by.call(public_author)).to eq([public_post.id])
      expect(authored_by.call(locked_author)).to eq([locked_post.id])
      expect(rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new).posts.map(&:id)).to contain_exactly(public_post.id, locked_post.id)

      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: locked_author, status: "approved")
      expect(authored_by.call(locked_author)).to contain_exactly(locked_post.id, followers_post.id)

      Social::Slice["repositories.block_repository"].block(blocker_profile_id: public_author, blocked_profile_id: viewer)
      expect(authored_by.call(public_author)).to be_empty

      act_as(locked_author)
      expect(authored_by.call(locked_author)).to contain_exactly(locked_post.id, followers_post.id)
    end

    it "serves the feed with hydrated posts" do
      act_as(viewer)

      feed = rpc(Feed::Grpc::Handler, :list_feed, Feed::V1::ListFeedRequest.new(filter: :FEED_FILTER_ALL))

      expect(feed.posts.map(&:id)).to contain_exactly(public_post.id, locked_post.id)
      expect(feed.posts.find { |post| post.id == public_post.id }.author_profile_id).to eq(public_author)
    end
  end
end
