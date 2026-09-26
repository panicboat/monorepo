# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::Comments::ListReplies", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.comments.list_replies"] }
  let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:author_id) { SecureRandom.uuid_v7 }
  let(:post) { post_repo.create_post(author_id: author_id, content: "Test post") }

  describe "#call" do
    it "includes the replier's username in the hydrated author" do
      user_id = SecureRandom.uuid_v7
      profile_repo.create(account_id: user_id, display_name: "Coco", username: "coco_u")
      parent = comment_repo.create_comment(post_id: post.id, user_id: user_id, content: "Parent")
      comment_repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply", parent_id: parent.id)

      result = use_case.call(comment_id: parent.id)

      expect(result[:authors][user_id][:username]).to eq("coco_u")
    end
  end
end
