# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::Comments::ListReplies", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.comments.list_replies"] }
  let(:add_comment) { Hanami.app.slices[:post]["use_cases.comments.add_comment"] }
  let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:author_profile_id) { create_account_with_profile }
  let(:post) { post_repo.create_post(author_profile_id: author_profile_id, content: "Test post") }

  describe "#call" do
    it "includes the replier's username in the hydrated author" do
      author_profile_id = create_account_with_profile(display_name: "Coco", username: "coco_u")
      parent = comment_repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Parent")
      comment_repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Reply", parent_id: parent.id)

      result = use_case.call(comment_id: parent.id)

      expect(result[:authors][author_profile_id][:username]).to eq("coco_u")
    end

    it "returns mentioned_usernames for a reply mention" do
      mentioned_id = create_account_with_profile(display_name: "Mentioned", username: "mentioned_user")
      reply_author_profile_id = create_account_with_profile
      parent = comment_repo.create_comment(post_id: post.id, author_profile_id: reply_author_profile_id, content: "Parent")
      add_comment.call(
        post_id: post.id,
        author_profile_id: reply_author_profile_id,
        content: "hi @mentioned_user",
        parent_id: parent.id
      )

      result = use_case.call(comment_id: parent.id)

      expect(result[:mentioned_usernames][mentioned_id]).to eq("mentioned_user")
    end
  end
end
