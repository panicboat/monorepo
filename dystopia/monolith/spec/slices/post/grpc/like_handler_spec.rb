# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/like_handler"

RSpec.describe Post::Grpc::LikeHandler, type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:notification_repo) { Notifications::Slice["repositories.notification_repository"] }
  let(:author) { create_account_with_profile(role: 2, username: "like_author") }
  let(:liker) { create_account_with_profile(username: "like_viewer") }
  let(:liked_post) { post_repo.create_post(author_profile_id: author, content: "like me", visibility: "public") }

  after { Current.clear }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  describe "#like_post" do
    it "notifies the author once when the same profile likes the post again" do
      act_as(liker)

      first = rpc(:like_post, Post::V1::LikePostRequest.new(post_id: liked_post.id))
      again = rpc(:like_post, Post::V1::LikePostRequest.new(post_id: liked_post.id))

      expect([first.likes_count, again.likes_count]).to eq([1, 1])
      expect(notification_repo.list(recipient_profile_id: author).map { |n| [n.type, n.actor_count] }).to eq([["like", 1]])
    end

    it "leaves the likes of profiles the viewer blocks out of the returned count" do
      blocked = create_account_with_profile(username: "like_blocked")
      Post::Slice["repositories.like_repository"].profile_like(post_id: liked_post.id, profile_id: blocked)
      Social::Slice["repositories.block_repository"].block(blocker_profile_id: liker, blocked_profile_id: blocked)
      act_as(liker)

      liked = rpc(:like_post, Post::V1::LikePostRequest.new(post_id: liked_post.id))

      expect(liked.likes_count).to eq(1)
    end
  end

  describe "#unlike_post" do
    it "leaves the likes of profiles the viewer blocks out of the returned count" do
      blocked = create_account_with_profile(username: "unlike_blocked")
      likes = Post::Slice["repositories.like_repository"]
      likes.profile_like(post_id: liked_post.id, profile_id: blocked)
      likes.profile_like(post_id: liked_post.id, profile_id: liker)
      Social::Slice["repositories.block_repository"].block(blocker_profile_id: liker, blocked_profile_id: blocked)
      act_as(liker)

      unliked = rpc(:unlike_post, Post::V1::UnlikePostRequest.new(post_id: liked_post.id))

      expect(unliked.likes_count).to eq(0)
    end
  end
end
