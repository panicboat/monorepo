# frozen_string_literal: true

require "spec_helper"
require "post/v1/post_service_pb"

RSpec.describe "Post::UseCases::Posts::ListPostsByIds", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.posts.list_posts_by_ids"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }

  describe "#call" do
    it "resolves mention usernames in hydrated post protos" do
      mentioned_id = create_account_with_profile(display_name: "Mentioned", username: "mentioned_user")
      post = post_repo.create_post(
        author_id: create_account_with_profile,
        content: "hi @mentioned_user",
        visibility: "public"
      )
      post_repo.save_mentions(
        post_id: post.id,
        mentions: [{ account_id: mentioned_id, position: 3, length: 15 }]
      )

      result = use_case.call(post_ids: [post.id])

      expect(result.fetch(post.id.to_s).mentions.first.username).to eq("mentioned_user")
    end
  end
end
