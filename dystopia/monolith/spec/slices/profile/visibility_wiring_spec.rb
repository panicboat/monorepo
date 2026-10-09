# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "gruf"
require "lib/grpc/authenticatable"
require "slices/profile/grpc/profile_handler"
require "slices/post/grpc/post_handler"
require "slices/post/grpc/comment_handler"
require "slices/post/grpc/like_handler"
require "slices/social/grpc/follow_handler"
require "slices/bookmarks/grpc/bookmark_handler"
require "slices/messaging/grpc/messaging_handler"
require "slices/feed/grpc/handler"
require "slices/review/grpc/review_handler"
require "slices/footprints/grpc/footprints_handler"

RSpec.describe "Visibility of a profile that others must not see", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:comment_repo) { Post::Slice["repositories.comment_repository"] }
  let(:like_repo) { Post::Slice["repositories.like_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:review_repo) { Review::Slice["repositories.entry_repository"] }

  let(:ghost_account) { create_account(role: 2) }
  let!(:ghost) { create_account_with_profile(account_id: ghost_account, username: "ghost_cast", display_name: "Ghost", prefecture: "東京都") }
  let!(:shown) { create_account_with_profile(role: 2, username: "shown_cast", display_name: "Shown", prefecture: "東京都") }
  let!(:viewer) { create_account_with_profile(username: "visible_viewer") }
  let!(:stranger) { create_account_with_profile(username: "visible_stranger") }

  let!(:ghost_post) { post_repo.create_post(author_profile_id: ghost, content: "visibility ghost", visibility: "public") }
  let!(:shown_post) { post_repo.create_post(author_profile_id: shown, content: "visibility shown", visibility: "public") }
  let!(:shown_comment) { comment_repo.create_comment(post_id: shown_post.id, author_profile_id: viewer, content: "by viewer") }

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

  def post_ids(posts)
    posts.map(&:id)
  end

  before do
    comment_repo.create_comment(post_id: shown_post.id, author_profile_id: ghost, content: "by ghost")
    comment_repo.create_comment(post_id: shown_post.id, author_profile_id: ghost, content: "reply by ghost", parent_id: shown_comment.id)
    like_repo.profile_like(post_id: ghost_post.id, profile_id: viewer)
    Bookmarks::Slice["repositories.bookmark_repository"].bookmark(profile_id: viewer, post_id: ghost_post.id)
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: ghost, status: "approved")
    follow_repo.follow(follower_profile_id: ghost, followee_profile_id: viewer, status: "approved")
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: shown, status: "approved")
    Messaging::Slice["use_cases.send_message"].call(sender_profile_id: ghost, content: "hello", recipient_profile_id: viewer)
    Notifications::Slice["use_cases.emit"].call(recipient_profile_id: viewer, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: ghost)
    Notifications::Slice["use_cases.emit"].call(recipient_profile_id: viewer, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: shown)
    review_repo.create(author_profile_id: ghost, target_profile_id: shown, rating: 4.0, body: "by ghost")
    review_repo.create(author_profile_id: viewer, target_profile_id: ghost, rating: 4.0, body: "about ghost")
    review_repo.create(author_profile_id: viewer, target_profile_id: shown, rating: 4.0, body: "about shown")
    Footprints::Slice["repositories.footprints_repository"].upsert_visit(visitor_profile_id: ghost, visited_profile_id: viewer)
    Footprints::Slice["repositories.footprints_repository"].upsert_visit(visitor_profile_id: shown, visited_profile_id: viewer)
    Schedule::Slice["repositories.schedule_repository"].upsert(profile_id: ghost, work_date: "2026-10-20", start_time: "20:00", end_time: "02:00")
  end

  after { Current.clear }

  shared_examples "a profile that reads as nonexistent" do
    before { hide.call }

    it "is not returned by the profile lookups, the search or the suggestions" do
      act_as(viewer)

      expect(rpc(Profile::Grpc::ProfileHandler, :get_profile, Profile::V1::GetProfileRequest.new(profile_id: ghost)).profile).to be_nil
      expect {
        rpc(Profile::Grpc::ProfileHandler, :get_profile_by_username, Profile::V1::GetProfileByUsernameRequest.new(username: "ghost_cast"))
      }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect(Discovery::Slice["use_cases.search_users"].call(query: "_cast")[:profiles].map(&:id)).to eq([shown])
      expect(Discovery::Slice["use_cases.suggest_users"].call(viewer_profile_id: stranger)[:profiles].map(&:id)).to eq([shown])
      expect(Profile::Slice["use_cases.get_role"].call(profile_id: ghost)).to be_nil
      expect(Post::UseCases::ExtractMentions.new.call(content: "@ghost_cast @shown_cast").map { |mention| mention[:profile_id] }).to eq([shown])
    end

    it "is left out of the profile lists before they are paged" do
      repo = Hanami.app.slices[:profile]["repositories.profile_repository"]

      expect(repo.search_by_query(query: "_cast").map(&:id)).to eq([shown])
      expect(repo.list_recent(limit: 10).map(&:id)).to contain_exactly(shown, viewer, stranger)
      expect(repo.profile_ids_by_prefecture("東京都")).to eq([shown])
      expect(repo.find_by_id(ghost).id).to eq(ghost)
      expect(repo.username_available?("ghost_cast")).to be false
    end

    it "has no posts anywhere a post is read" do
      act_as(viewer)

      expect { rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: ghost_post.id)) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect(rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: ghost)).posts).to be_empty
      expect(post_ids(rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new).posts)).to eq([shown_post.id])
      expect(post_ids(rpc(Feed::Grpc::Handler, :list_feed, Feed::V1::ListFeedRequest.new(filter: :FEED_FILTER_ALL)).posts)).to eq([shown_post.id])
      expect(post_ids(rpc(Feed::Grpc::Handler, :list_feed, Feed::V1::ListFeedRequest.new(filter: :FEED_FILTER_FOLLOWING)).posts)).to eq([shown_post.id])
      expect(post_ids(rpc(Feed::Grpc::Handler, :list_feed, Feed::V1::ListFeedRequest.new(filter: :FEED_FILTER_AREA, prefecture: "東京都")).posts)).to eq([shown_post.id])
      expect(post_ids(Discovery::Slice["use_cases.search_posts"].call(query: "visibility", viewer_profile_id: viewer)[:posts])).to eq([shown_post.id])
      expect(post_ids(Discovery::Slice["use_cases.rank_posts"].call(period: "all", viewer_profile_id: viewer)[:posts])).to eq([shown_post.id])
      expect(Bookmarks::Slice["use_cases.list_bookmarks"].call(profile_id: viewer)[:posts]).to be_empty
      expect(Post::Slice["use_cases.likes.list_liked_posts_by_profile"].call(profile_id: viewer, viewer_profile_id: viewer)[:posts]).to be_empty
    end

    it "has no comments or replies under other profiles' posts" do
      comments = Post::Slice["use_cases.comments.list_comments"].call(post_id: shown_post.id)[:comments]
      replies = Post::Slice["use_cases.comments.list_replies"].call(comment_id: shown_comment.id)[:replies]

      expect(comments.map(&:author_profile_id)).to eq([viewer])
      expect(replies).to be_empty
    end

    it "is absent from follow lists and cannot be followed" do
      followers = Social::Slice["use_cases.follows.list_followers"].call(profile_id: viewer)[:profiles]
      following = Social::Slice["use_cases.follows.list_following"].call(profile_id: viewer)[:profiles]
      attempt = Social::Slice["use_cases.follows.follow"].call(follower_profile_id: stranger, target_profile_id: ghost)

      expect(followers.map(&:id)).to be_empty
      expect(following.map(&:id)).to eq([shown])
      expect(attempt[:status]).to eq("none")
      expect(db[:social__follows].where(follower_profile_id: stranger).count).to eq(0)
    end

    it "leaves its conversation without a counterpart and cannot be messaged" do
      threads = Messaging::Slice["use_cases.list_threads"].call(profile_id: viewer)[:threads]
      thread_id = threads.first[:row].id
      send_message = Messaging::Slice["use_cases.send_message"]
      open_thread = Messaging::Slice["use_cases.get_or_create_thread"]

      expect(threads.map { |thread| thread[:counterpart] }).to eq([nil])
      expect { send_message.call(sender_profile_id: viewer, content: "anyone?", thread_id: thread_id) }
        .to raise_error(Messaging::UseCases::SendMessage::RecipientUnresolvedError)
      expect { open_thread.call(viewer_profile_id: shown, recipient_profile_id: ghost) }
        .to raise_error(Messaging::UseCases::GetOrCreateThread::RecipientUnresolvedError)
      expect(db[:messaging__messages].count).to eq(1)
      expect(db[:messaging__threads].count).to eq(1)
    end

    it "is absent from notifications, footprints and schedules" do
      notifications = Notifications::Slice["use_cases.list_notifications"].call(recipient_profile_id: viewer)
      act_as(viewer)
      footprints = rpc(Footprints::Grpc::FootprintsHandler, :list_footprints, Footprints::V1::ListFootprintsRequest.new).footprints
      schedules = Schedule::Slice["use_cases.list_schedules"].call(profile_id: ghost, from_date: "2026-10-01", to_date: "2026-10-31")

      expect(notifications[:rows].map(&:latest_actor_profile_id)).to eq([shown])
      expect(footprints.map { |footprint| footprint.visitor.id }).to eq([shown])
      expect(schedules).to be_empty
      expect(Footprints::Slice["use_cases.record_visit"].call(visitor_profile_id: stranger, visited_profile_id: ghost)).to be_nil
      expect(db[:footprints__visits].where(visited_profile_id: ghost).count).to eq(0)
    end

    it "has no reviews as author or target and cannot be reviewed" do
      act_as(stranger)
      by_target = ->(profile_id) { rpc(Review::Grpc::ReviewHandler, :list_entries_by_target, Review::V1::ListEntriesByTargetRequest.new(target_profile_id: profile_id)).entries }
      by_author = ->(profile_id) { rpc(Review::Grpc::ReviewHandler, :list_entries_by_author, Review::V1::ListEntriesByAuthorRequest.new(author_profile_id: profile_id)).entries }
      recent = rpc(Review::Grpc::ReviewHandler, :list_recent_entries, Review::V1::ListRecentEntriesRequest.new).entries

      expect(by_target.call(shown).map(&:author_profile_id)).to eq([viewer])
      expect(by_target.call(ghost)).to be_empty
      expect(by_author.call(ghost)).to be_empty
      expect(by_author.call(viewer).map(&:target_profile_id)).to eq([shown])
      expect(recent.map { |entry| [entry.author_profile_id, entry.target_profile_id] }).to eq([[viewer, shown]])
      expect {
        rpc(Review::Grpc::ReviewHandler, :create_entry, Review::V1::CreateEntryRequest.new(target_profile_id: ghost, rating: 4.0))
      }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "answers a request that names it as it answers for a profile that does not exist" do
      post_repo.create_post(author_profile_id: ghost, content: "visibility ghost again", visibility: "public")
      review_repo.create(author_profile_id: stranger, target_profile_id: ghost, rating: 3.0, body: "also about ghost")
      review_repo.create(author_profile_id: ghost, target_profile_id: create_account_with_profile(role: 2, username: "another_cast"), rating: 3.0, body: "also by ghost")
      act_as(stranger)
      answers = lambda do |profile_id|
        posts = rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: profile_id, limit: 1))
        received = rpc(Review::Grpc::ReviewHandler, :list_entries_by_target, Review::V1::ListEntriesByTargetRequest.new(target_profile_id: profile_id, limit: 1))
        written = rpc(Review::Grpc::ReviewHandler, :list_entries_by_author, Review::V1::ListEntriesByAuthorRequest.new(author_profile_id: profile_id, limit: 1))
        counts = rpc(Social::Grpc::FollowHandler, :get_social_counts, Social::V1::GetSocialCountsRequest.new(profile_id: profile_id))
        {
          posts: [posts.posts.length, posts.has_more, posts.next_cursor],
          received_reviews: [received.entries.length, received.has_more, received.next_cursor],
          written_reviews: [written.entries.length, written.has_more, written.next_cursor],
          comments: rpc(Post::Grpc::CommentHandler, :list_comments_by_author, Post::V1::ListCommentsByAuthorRequest.new(author_profile_id: profile_id)).comments.length,
          followers: rpc(Social::Grpc::FollowHandler, :list_followers, Social::V1::ListFollowersRequest.new(profile_id: profile_id)).profiles.length,
          following: rpc(Social::Grpc::FollowHandler, :list_following, Social::V1::ListFollowingRequest.new(profile_id: profile_id)).profiles.length,
          counts: [counts.following_count, counts.followers_count]
        }
      end

      expect(answers.call(ghost)).to eq(answers.call(SecureRandom.uuid_v7))
    end

    it "is absent from the reviews on the other party's own page" do
      act_as(shown)
      received = rpc(Review::Grpc::ReviewHandler, :list_entries_by_target, Review::V1::ListEntriesByTargetRequest.new(target_profile_id: shown)).entries
      act_as(viewer)
      written = rpc(Review::Grpc::ReviewHandler, :list_entries_by_author, Review::V1::ListEntriesByAuthorRequest.new(author_profile_id: viewer)).entries

      expect(received.map(&:author_profile_id)).to eq([viewer])
      expect(written.map(&:target_profile_id)).to eq([shown])
    end

    it "leaves a review with it out of reach for the other party" do
      by_ghost = db[:review__entries].where(author_profile_id: ghost).get(:id)
      about_ghost = db[:review__entries].where(target_profile_id: ghost).get(:id)
      not_found = GRPC::Core::StatusCodes::NOT_FOUND

      act_as(shown)
      expect { rpc(Review::Grpc::ReviewHandler, :hide_entry, Review::V1::HideEntryRequest.new(entry_id: by_ghost)) }.to status(not_found)
      expect { rpc(Review::Grpc::ReviewHandler, :unhide_entry, Review::V1::UnhideEntryRequest.new(entry_id: by_ghost)) }.to status(not_found)
      act_as(viewer)
      expect { rpc(Review::Grpc::ReviewHandler, :update_entry, Review::V1::UpdateEntryRequest.new(entry_id: about_ghost, rating: 1.0)) }.to status(not_found)
      expect { rpc(Review::Grpc::ReviewHandler, :delete_entry, Review::V1::DeleteEntryRequest.new(entry_id: about_ghost)) }.to status(not_found)
      expect(db[:review__entries].where(hidden: false, rating: 4.0).count).to eq(3)
    end

    it "leaves its posts and comments out of reach for likes, comments and their lists" do
      ghost_comment = db[:post__comments].where(author_profile_id: ghost, parent_id: nil).get(:id)
      under_ghost_post = comment_repo.create_comment(post_id: ghost_post.id, author_profile_id: shown, content: "under the post")
      like_repo.profile_like(post_id: ghost_post.id, profile_id: shown)
      comment_repo.create_comment(post_id: shown_post.id, author_profile_id: viewer, content: "under the comment", parent_id: ghost_comment)
      notifications_before = db[:notifications__notifications].count

      act_as(stranger)
      expect { rpc(Post::Grpc::LikeHandler, :like_post, Post::V1::LikePostRequest.new(post_id: ghost_post.id)) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect { rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: ghost_post.id, content: "anyone?")) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect {
        rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: shown_post.id, content: "anyone?", parent_id: ghost_comment))
      }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect(rpc(Post::Grpc::CommentHandler, :list_comments, Post::V1::ListCommentsRequest.new(post_id: ghost_post.id)).comments).to be_empty
      expect(rpc(Post::Grpc::CommentHandler, :list_replies, Post::V1::ListRepliesRequest.new(comment_id: ghost_comment)).replies).to be_empty
      expect {
        rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: shown_post.id, content: "anyone?", parent_id: under_ghost_post.id))
      }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      by_shown = rpc(Post::Grpc::CommentHandler, :list_comments_by_author, Post::V1::ListCommentsByAuthorRequest.new(author_profile_id: shown)).comments
      by_viewer = rpc(Post::Grpc::CommentHandler, :list_comments_by_author, Post::V1::ListCommentsByAuthorRequest.new(author_profile_id: viewer)).comments
      expect(by_shown).to be_empty
      expect(by_viewer.map(&:id)).to eq([shown_comment.id])
      expect(db[:post__likes].where(profile_id: stranger).count).to eq(0)
      expect(db[:post__comments].where(author_profile_id: stranger).count).to eq(0)
      expect(db[:notifications__notifications].count).to eq(notifications_before)

      act_as(viewer)
      liked = rpc(Post::Grpc::LikeHandler, :get_like_status, Post::V1::GetLikeStatusRequest.new(post_ids: [ghost_post.id])).liked
      bookmarked = rpc(Bookmarks::Grpc::BookmarkHandler, :get_bookmark_status, Bookmarks::V1::GetBookmarkStatusRequest.new(post_ids: [ghost_post.id])).bookmarked
      unliked = rpc(Post::Grpc::LikeHandler, :unlike_post, Post::V1::UnlikePostRequest.new(post_id: ghost_post.id))

      expect(liked.to_h).to eq(ghost_post.id => false)
      expect(bookmarked.to_h).to eq(ghost_post.id => false)
      expect(unliked.likes_count).to eq(0)
    end

    it "reports no relationship with it" do
      missing = SecureRandom.uuid_v7
      follow_repo.follow(follower_profile_id: ghost, followee_profile_id: stranger, status: "pending")
      Social::Slice["repositories.block_repository"].block(blocker_profile_id: shown, blocked_profile_id: ghost)

      act_as(viewer)
      statuses = rpc(Social::Grpc::FollowHandler, :get_follow_status, Social::V1::GetFollowStatusRequest.new(target_profile_ids: [ghost, missing, shown])).statuses
      act_as(stranger)
      pending_count = rpc(Social::Grpc::FollowHandler, :get_pending_follow_count, Social::V1::GetPendingFollowCountRequest.new).count
      pending = rpc(Social::Grpc::FollowHandler, :list_pending_follow_requests, Social::V1::ListPendingFollowRequestsRequest.new).profiles
      blocked = Social::Slice["use_cases.blocks.list_blocked"].call(blocker_profile_id: shown)[:profiles]

      expect(statuses[ghost]).to eq(statuses[missing])
      expect(statuses[shown]).not_to eq(statuses[missing])
      expect(pending_count).to eq(0)
      expect(pending).to be_empty
      expect(blocked).to be_empty
    end

    it "leaves no trace of its id in the conversation and has a new message rejected" do
      act_as(viewer)
      thread = rpc(Messaging::Grpc::MessagingHandler, :list_threads, Messaging::V1::ListThreadsRequest.new).threads.first
      Messaging::Slice["repositories.messaging_repository"].insert_message(thread_id: thread.id, sender_profile_id: viewer, content: "my own line")
      messages = rpc(Messaging::Grpc::MessagingHandler, :list_messages, Messaging::V1::ListMessagesRequest.new(thread_id: thread.id)).messages

      expect(thread.counterpart).to be_nil
      expect(thread.last_message.sender_profile_id).to eq("")
      expect(messages.map(&:sender_profile_id)).to contain_exactly("", viewer)
      expect {
        rpc(Messaging::Grpc::MessagingHandler, :send_message, Messaging::V1::SendMessageRequest.new(thread_id: thread.id, content: "anyone?"))
      }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "is not named by a mention stored before it was hidden" do
      mentioning = post_repo.create_post(author_profile_id: shown, content: "hi @ghost_cast and @visible_viewer", visibility: "public")
      post_repo.save_mentions(post_id: mentioning.id, mentions: [{ profile_id: ghost, position: 3, length: 11 }, { profile_id: viewer, position: 19, length: 15 }])
      act_as(stranger)

      mentions = rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: mentioning.id)).post.mentions

      expect(mentions.map(&:profile_id)).to eq([viewer])
    end

    it "is still listed for its own account and comes back when it is shown again" do
      Current.account_id = ghost_account
      mine = rpc(Profile::Grpc::ProfileHandler, :list_my_profiles, Profile::V1::ListMyProfilesRequest.new).profiles
      expect(mine.map(&:id)).to eq([ghost])

      show.call
      act_as(viewer)

      expect(rpc(Profile::Grpc::ProfileHandler, :get_profile, Profile::V1::GetProfileRequest.new(profile_id: ghost)).profile.id).to eq(ghost)
      expect(rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: ghost_post.id)).post.id).to eq(ghost_post.id)
      expect(Social::Slice["use_cases.follows.list_followers"].call(profile_id: viewer)[:profiles].map(&:id)).to eq([ghost])
    end
  end

  context "when the profile is disabled" do
    let(:hide) { -> { db[:profile__profiles].where(id: ghost).update(disabled_at: Time.now) } }
    let(:show) { -> { db[:profile__profiles].where(id: ghost).update(disabled_at: nil) } }

    it_behaves_like "a profile that reads as nonexistent"
  end

  context "when the profile's account is deactivated" do
    let(:hide) { -> { db[:identity__accounts].where(id: ghost_account).update(deactivated_at: Time.now) } }
    let(:show) { -> { db[:identity__accounts].where(id: ghost_account).update(deactivated_at: nil) } }

    it_behaves_like "a profile that reads as nonexistent"
  end

  it "shows the profile everywhere while it is enabled and its account is active" do
    act_as(viewer)

    expect(rpc(Profile::Grpc::ProfileHandler, :get_profile, Profile::V1::GetProfileRequest.new(profile_id: ghost)).profile.id).to eq(ghost)
    expect(post_ids(rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: ghost)).posts)).to eq([ghost_post.id])
    expect(Post::Slice["use_cases.comments.list_comments"].call(post_id: shown_post.id)[:comments].map(&:author_profile_id)).to contain_exactly(viewer, ghost)
    expect(Notifications::Slice["use_cases.list_notifications"].call(recipient_profile_id: viewer)[:rows].map(&:latest_actor_profile_id)).to contain_exactly(ghost, shown)
    expect(Schedule::Slice["use_cases.list_schedules"].call(profile_id: ghost, from_date: "2026-10-01", to_date: "2026-10-31").length).to eq(1)
  end
end
