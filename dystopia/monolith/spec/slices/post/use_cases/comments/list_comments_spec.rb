# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::Comments::ListComments", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.comments.list_comments"] }
  let(:add_comment) { Hanami.app.slices[:post]["use_cases.comments.add_comment"] }
  let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:post_author_profile_id) { create_account_with_profile }
  let(:post) { post_repo.create_post(author_profile_id: post_author_profile_id, content: "Test post") }

  describe "#call" do
    it "includes the commenter's username in the hydrated author" do
      author_profile_id = create_account_with_profile(display_name: "Coco", username: "coco_u")
      comment_repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Nice post!")

      result = use_case.call(post_id: post.id)

      expect(result[:authors][author_profile_id].username).to eq("coco_u")
    end

    it "fills the page past comments of a disabled author and reports no more" do
      db = Hanami.app["db.gateway"].connection
      hidden = create_account_with_profile(username: "lc_hidden")
      shown = comment_repo.create_comment(post_id: post.id, author_profile_id: create_account_with_profile(username: "lc_shown"), content: "shown")
      db[:post__comments].where(id: shown.id).update(created_at: Time.now - 60)
      2.times do |i|
        hidden_comment = comment_repo.create_comment(post_id: post.id, author_profile_id: hidden, content: "hidden")
        db[:post__comments].where(id: hidden_comment.id).update(created_at: Time.now - (3600 * (i + 1)))
      end
      db[:profile__profiles].where(id: hidden).update(disabled_at: Time.now)

      result = use_case.call(post_id: post.id, limit: 1)

      expect([result[:comments].map(&:id), result[:has_more]]).to eq([[shown.id], false])
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
