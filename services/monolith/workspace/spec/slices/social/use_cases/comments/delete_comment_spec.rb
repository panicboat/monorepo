# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Comments::DeleteComment do
  let(:use_case) { described_class.new(comment_repo: comment_repo) }
  let(:comment_repo) { double(:comment_repo) }

  let(:comment_id) { "comment-1" }
  let(:user_id) { "user-1" }
  let(:post_id) { "post-1" }

  describe "#call" do
    it "deletes a comment and returns updated comments count" do
      allow(comment_repo).to receive(:delete_comment)
        .with(id: comment_id, user_id: user_id)
        .and_return({ post_id: post_id, deleted_count: 1 })
      allow(comment_repo).to receive(:comments_count)
        .with(post_id: post_id)
        .and_return(4)

      result = use_case.call(comment_id: comment_id, user_id: user_id)

      expect(result[:comments_count]).to eq(4)
    end

    it "raises CommentNotFoundOrUnauthorizedError when comment does not exist" do
      allow(comment_repo).to receive(:delete_comment)
        .with(id: comment_id, user_id: user_id)
        .and_return(nil)

      expect {
        use_case.call(comment_id: comment_id, user_id: user_id)
      }.to raise_error(described_class::CommentNotFoundOrUnauthorizedError)
    end

    it "raises CommentNotFoundOrUnauthorizedError when user is not the owner" do
      other_user_id = "other-user"
      allow(comment_repo).to receive(:delete_comment)
        .with(id: comment_id, user_id: other_user_id)
        .and_return(nil)

      expect {
        use_case.call(comment_id: comment_id, user_id: other_user_id)
      }.to raise_error(described_class::CommentNotFoundOrUnauthorizedError)
    end
  end
end
