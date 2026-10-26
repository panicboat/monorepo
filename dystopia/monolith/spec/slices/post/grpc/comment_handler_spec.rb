# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/comment_handler"

RSpec.describe Post::Grpc::CommentHandler, type: :database do
  describe "#get_comment_author" do
    let(:handler) do
      described_class.new(
        method_key: :test,
        service: double,
        rpc_desc: double,
        active_call: double,
        message: double(:message)
      )
    end

    it "includes the author's username" do
      author_profile_id = create_account_with_profile(display_name: "Coco", username: "coco_u")

      author = handler.send(:get_comment_author, author_profile_id)

      expect(author.username).to eq("coco_u")
    end

    it "returns nil when the profile cannot be resolved" do
      author = handler.send(:get_comment_author, SecureRandom.uuid_v7)

      expect(author).to be_nil
    end
  end

  describe "#list_comments_by_author" do
    let(:handler) do
      described_class.new(
        method_key: :list_comments_by_author,
        service: double,
        rpc_desc: double,
        active_call: double,
        message: message
      )
    end
    let(:message) do
      Post::V1::ListCommentsByAuthorRequest.new(author_profile_id: reply_author_profile_id, limit: 20, cursor: "")
    end

    let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
    let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }

    let(:post_author_profile_id) { create_account_with_profile }
    let(:reply_author_profile_id) { create_account_with_profile(display_name: "テストゲスト", username: "test_guest_2") }

    after { Current.clear }

    it "hydrates the reply author's display name and avatar instead of leaving them blank" do
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = post_author_profile_id
      post = post_repo.create_post(author_profile_id: post_author_profile_id, content: "元の投稿")
      comment_repo.create_comment(post_id: post.id, author_profile_id: reply_author_profile_id, content: "bbbb")

      response = handler.list_comments_by_author

      author = response.comments.first.author
      expect(author).not_to be_nil
      expect(author.display_name).to eq("テストゲスト")
    end

    it "leaves out the comments of an author the viewer blocks, and keeps them for a viewer the author blocks" do
      post = post_repo.create_post(author_profile_id: post_author_profile_id, content: "元の投稿")
      comment_repo.create_comment(post_id: post.id, author_profile_id: reply_author_profile_id, content: "bbbb")
      blocker = create_account_with_profile(username: "replies_blocker")
      blocked = create_account_with_profile(username: "replies_blocked")
      blocks = Social::Slice["repositories.block_repository"]
      blocks.block(blocker_profile_id: blocker, blocked_profile_id: reply_author_profile_id)
      blocks.block(blocker_profile_id: reply_author_profile_id, blocked_profile_id: blocked)

      listed = [blocker, blocked].map do |viewer|
        Current.account_id = SecureRandom.uuid_v7
        Current.profile_id = viewer
        handler.list_comments_by_author.comments.length
      end

      expect(listed).to eq([0, 1])
    end
  end

  describe "#add_comment mentions" do
    let(:handler) do
      described_class.new(method_key: :add_comment, service: double, rpc_desc: double, active_call: double, message: message)
    end
    let(:message) { Post::V1::AddCommentRequest.new(post_id: post.id, content: "hi @mentioned_user") }
    let(:author_profile_id) { create_account_with_profile }
    let(:mentioned_id) { create_account_with_profile(display_name: "Mentioned", username: "mentioned_user") }
    let(:post) { post_repo.create_post(author_profile_id: create_account_with_profile, content: "post") }
    let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }

    before do
      mentioned_id
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = author_profile_id
    end

    after { Current.clear }

    it "resolves the mentioned username in the response" do
      response = handler.add_comment

      expect(response.comment.mentions.length).to eq(1)
      expect(response.comment.mentions.first.username).to eq("mentioned_user")
    end
  end

  describe "#add_comment mentions on a followers-only post" do
    let(:handler) do
      message = Post::V1::AddCommentRequest.new(post_id: post.id, content: "hi @follower_user @stranger_user @author_user")
      described_class.new(method_key: :add_comment, service: double, rpc_desc: double, active_call: double, message: message)
    end
    let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
    let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
    let(:author_profile_id) { create_account_with_profile(display_name: "Author", username: "author_user") }
    let(:follower_id) { create_account_with_profile(display_name: "Follower", username: "follower_user") }
    let(:stranger_id) { create_account_with_profile(display_name: "Stranger", username: "stranger_user") }
    let(:visibility) { "private" }
    let(:post) { post_repo.create_post(author_profile_id: author_profile_id, content: "post", visibility: visibility) }

    before do
      Social::Slice["repositories.follow_repository"].follow(follower_profile_id: follower_id, followee_profile_id: author_profile_id, status: "approved")
      stranger_id
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = author_profile_id
    end

    after { Current.clear }

    def mention_types_for(profile_id)
      notification_repo.list(recipient_profile_id: profile_id).map(&:type).select { |type| type == "mention" }
    end

    it "notifies approved followers and not people who cannot see the post" do
      handler.add_comment

      expect(mention_types_for(follower_id)).to eq(["mention"])
      expect(mention_types_for(stranger_id)).to be_empty
    end

    it "does not notify the author about their own mention" do
      handler.add_comment

      expect(mention_types_for(author_profile_id)).to be_empty
    end

    context "when the post is public" do
      let(:visibility) { "public" }

      it "notifies everyone mentioned" do
        handler.add_comment

        expect(mention_types_for(follower_id)).to eq(["mention"])
        expect(mention_types_for(stranger_id)).to eq(["mention"])
      end
    end
  end
end
