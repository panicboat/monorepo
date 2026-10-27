# frozen_string_literal: true

require "spec_helper"
require "post/v1/post_service_pb"

RSpec.describe "Post::UseCases::Likes::ListLikedPostsByProfile", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.likes.list_liked_posts_by_profile"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:like_repo) { Hanami.app.slices[:post]["repositories.like_repository"] }
  let(:profile_id) { SecureRandom.uuid_v7 }
  let(:other_profile_id) { SecureRandom.uuid_v7 }
  let(:post) { post_repo.create_post(author_profile_id: create_account_with_profile(role: 2), content: "Liked post", visibility: "public") }

  before { like_repo.profile_like(post_id: post.id, profile_id: profile_id) }

  describe "#call" do
    context "when the viewer requests their own likes" do
      it "returns the liked posts" do
        result = use_case.call(profile_id: profile_id, viewer_profile_id: profile_id)

        expect(result[:posts].map(&:id)).to contain_exactly(post.id)
      end
    end

    context "when liked posts the viewer cannot see follow the first one" do
      it "fills the page past them and reports no more" do
        db = Hanami.app["db.gateway"].connection
        hidden = create_account_with_profile(role: 2, username: "llp_hidden")
        db[:post__likes].where(post_id: post.id, profile_id: profile_id).update(created_at: Time.now - 60)
        2.times do |i|
          hidden_post = post_repo.create_post(author_profile_id: hidden, content: "hidden", visibility: "public")
          like_repo.profile_like(post_id: hidden_post.id, profile_id: profile_id)
          db[:post__likes].where(post_id: hidden_post.id, profile_id: profile_id).update(created_at: Time.now - (3600 * (i + 1)))
        end
        db[:profile__profiles].where(id: hidden).update(disabled_at: Time.now)

        result = use_case.call(profile_id: profile_id, viewer_profile_id: profile_id, limit: 1)

        expect([result[:posts].map(&:id), result[:has_more]]).to eq([[post.id], false])
      end
    end

    context "when the viewer requests another profile's likes" do
      it "raises ForbiddenError" do
        expect {
          use_case.call(profile_id: profile_id, viewer_profile_id: other_profile_id)
        }.to raise_error(Post::UseCases::Likes::ListLikedPostsByProfile::ForbiddenError)
      end
    end

    context "when there is no viewer" do
      it "raises ForbiddenError" do
        expect {
          use_case.call(profile_id: profile_id, viewer_profile_id: nil)
        }.to raise_error(Post::UseCases::Likes::ListLikedPostsByProfile::ForbiddenError)
      end
    end
  end
end
