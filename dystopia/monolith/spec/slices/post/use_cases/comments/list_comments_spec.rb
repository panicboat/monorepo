# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::Comments::ListComments", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.comments.list_comments"] }
  let(:add_comment) { Hanami.app.slices[:post]["use_cases.comments.add_comment"] }
  let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:author_profile_id) { create_account_with_profile }
  let(:post) { post_repo.create_post(author_profile_id: author_profile_id, content: "Test post") }

  describe "#call" do
    it "includes the commenter's username in the hydrated author" do
      author_profile_id = create_account_with_profile(display_name: "Coco", username: "coco_u")
      comment_repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Nice post!")

      result = use_case.call(post_id: post.id)

      expect(result[:authors][author_profile_id][:username]).to eq("coco_u")
    end

    context "when a comment contains a mention" do
      it "returns mentioned_usernames resolving the current username" do
        mentioned_id = create_account_with_profile(display_name: "Mentioned", username: "mentioned_user")
        add_comment.call(post_id: post.id, author_profile_id: create_account_with_profile, content: "hi @mentioned_user")

        result = use_case.call(post_id: post.id)

        expect(result[:mentioned_usernames][mentioned_id]).to eq("mentioned_user")
      end
    end
  end
end
