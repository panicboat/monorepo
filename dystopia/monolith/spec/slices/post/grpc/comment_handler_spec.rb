# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/comment_handler"

RSpec.describe Post::Grpc::CommentHandler, type: :database do
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

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
      user_id = SecureRandom.uuid_v7
      profile_repo.create(account_id: user_id, display_name: "Coco", username: "coco_u")

      author = handler.send(:get_comment_author, user_id)

      expect(author[:username]).to eq("coco_u")
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
      Post::V1::ListCommentsByAuthorRequest.new(author_id: reply_author_id, limit: 20, cursor: "")
    end

    let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }
    let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
    let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }

    let(:post_author_id) { create_account }
    let(:reply_author_id) { create_account }

    def create_account(role: 1)
      id = SecureRandom.uuid_v7
      db[:identity__accounts].insert(id: id, role: role, created_at: Time.now, updated_at: Time.now)
      id
    end

    after { Current.clear }

    it "hydrates the reply author's display name and avatar instead of leaving them blank" do
      Current.user_id = post_author_id
      profile_repo.create(account_id: reply_author_id, display_name: "テストゲスト", username: "test_guest_2")
      post = post_repo.create_post(author_id: post_author_id, content: "元の投稿")
      comment_repo.create_comment(post_id: post.id, user_id: reply_author_id, content: "bbbb")

      response = handler.list_comments_by_author

      author = response.comments.first.author
      expect(author).not_to be_nil
      expect(author.name).to eq("テストゲスト")
    end
  end

  describe "#add_comment mentions" do
    let(:handler) do
      described_class.new(method_key: :add_comment, service: double, rpc_desc: double, active_call: double, message: message)
    end
    let(:message) { Post::V1::AddCommentRequest.new(post_id: post.id, content: "hi @mentioned_user") }
    let(:author_id) { create_account }
    let(:mentioned_id) { SecureRandom.uuid_v7 }
    let(:post) { post_repo.create_post(author_id: create_account, content: "post") }
    let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
    let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }

    def create_account(role: 1)
      id = SecureRandom.uuid_v7
      db[:identity__accounts].insert(id: id, role: role, created_at: Time.now, updated_at: Time.now)
      id
    end

    before do
      profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")
      Current.user_id = author_id
    end

    after { Current.clear }

    it "resolves the mentioned username in the response" do
      response = handler.add_comment

      expect(response.comment.mentions.length).to eq(1)
      expect(response.comment.mentions.first.username).to eq("mentioned_user")
    end
  end
end
