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
  end
end
