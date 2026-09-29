# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::Comments::ListReplies", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.comments.list_replies"] }
  let(:add_comment) { Hanami.app.slices[:post]["use_cases.comments.add_comment"] }
  let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }
  let(:author_id) { SecureRandom.uuid_v7 }
  let(:post) { post_repo.create_post(author_id: author_id, content: "Test post") }

  def create_account(role: 1)
    id = SecureRandom.uuid_v7
    db[:identity__accounts].insert(id: id, role: role, created_at: Time.now, updated_at: Time.now)
    id
  end

  describe "#call" do
    it "includes the replier's username in the hydrated author" do
      user_id = SecureRandom.uuid_v7
      profile_repo.create(account_id: user_id, display_name: "Coco", username: "coco_u")
      parent = comment_repo.create_comment(post_id: post.id, user_id: user_id, content: "Parent")
      comment_repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply", parent_id: parent.id)

      result = use_case.call(comment_id: parent.id)

      expect(result[:authors][user_id][:username]).to eq("coco_u")
    end

    it "returns mentioned_usernames for a reply mention" do
      mentioned_id = SecureRandom.uuid_v7
      profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")
      reply_author_id = create_account
      parent = comment_repo.create_comment(post_id: post.id, user_id: reply_author_id, content: "Parent")
      add_comment.call(
        post_id: post.id,
        user_id: reply_author_id,
        content: "hi @mentioned_user",
        parent_id: parent.id
      )

      result = use_case.call(comment_id: parent.id)

      expect(result[:mentioned_usernames][mentioned_id]).to eq("mentioned_user")
    end
  end
end
