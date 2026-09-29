# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::Comments::ListComments", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.comments.list_comments"] }
  let(:add_comment) { Hanami.app.slices[:post]["use_cases.comments.add_comment"] }
  let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:author_id) { SecureRandom.uuid_v7 }
  let(:post) { post_repo.create_post(author_id: author_id, content: "Test post") }

  def create_account(role: 1)
    id = SecureRandom.uuid_v7
    db[:identity__accounts].insert(id: id, role: role, created_at: Time.now, updated_at: Time.now)
    id
  end

  describe "#call" do
    it "includes the commenter's username in the hydrated author" do
      user_id = SecureRandom.uuid_v7
      profile_repo.create(account_id: user_id, display_name: "Coco", username: "coco_u")
      comment_repo.create_comment(post_id: post.id, user_id: user_id, content: "Nice post!")

      result = use_case.call(post_id: post.id)

      expect(result[:authors][user_id][:username]).to eq("coco_u")
    end

    context "when a comment contains a mention" do
      it "returns mentioned_usernames resolving the current username" do
        mentioned_id = SecureRandom.uuid_v7
        profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")
        add_comment.call(post_id: post.id, user_id: create_account, content: "hi @mentioned_user")

        result = use_case.call(post_id: post.id)

        expect(result[:mentioned_usernames][mentioned_id]).to eq("mentioned_user")
      end
    end
  end
end
