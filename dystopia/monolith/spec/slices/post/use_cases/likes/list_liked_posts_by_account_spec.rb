# frozen_string_literal: true

require "spec_helper"
require "post/v1/post_service_pb"

RSpec.describe "Post::UseCases::Likes::ListLikedPostsByAccount", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.likes.list_liked_posts_by_account"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:like_repo) { Hanami.app.slices[:post]["repositories.like_repository"] }
  let(:account_id) { SecureRandom.uuid_v7 }
  let(:other_account_id) { SecureRandom.uuid_v7 }
  let(:post) { post_repo.create_post(author_id: SecureRandom.uuid_v7, content: "Liked post", visibility: "public") }

  before { like_repo.account_like(post_id: post.id, account_id: account_id) }

  describe "#call" do
    context "when the viewer requests their own likes" do
      it "returns the liked posts" do
        result = use_case.call(account_id: account_id, viewer_account_id: account_id)

        expect(result[:posts].map(&:id)).to contain_exactly(post.id)
      end
    end

    context "when the viewer requests another account's likes" do
      it "raises ForbiddenError" do
        expect {
          use_case.call(account_id: account_id, viewer_account_id: other_account_id)
        }.to raise_error(Post::UseCases::Likes::ListLikedPostsByAccount::ForbiddenError)
      end
    end

    context "when there is no viewer" do
      it "raises ForbiddenError" do
        expect {
          use_case.call(account_id: account_id, viewer_account_id: nil)
        }.to raise_error(Post::UseCases::Likes::ListLikedPostsByAccount::ForbiddenError)
      end
    end
  end
end
