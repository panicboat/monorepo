# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/comment_handler"

RSpec.describe Post::Grpc::CommentHandler, type: :database do
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
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  let(:post_author_id) { create_account }
  let(:reply_author_id) { create_account }

  def create_account(role: 1)
    id = SecureRandom.uuid_v7
    db[:identity__accounts].insert(id: id, role: role, created_at: Time.now, updated_at: Time.now)
    id
  end

  after { Current.clear }

  describe "#list_comments_by_author" do
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
end
