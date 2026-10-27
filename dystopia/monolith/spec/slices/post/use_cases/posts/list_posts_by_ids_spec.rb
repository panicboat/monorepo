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
        author_profile_id: create_account_with_profile,
        content: "hi @mentioned_user",
        visibility: "public"
      )
      post_repo.save_mentions(
        post_id: post.id,
        mentions: [{ profile_id: mentioned_id, position: 3, length: 15 }]
      )

      result = use_case.call(post_ids: [post.id])

      expect(result.fetch(post.id.to_s).mentions.first.username).to eq("mentioned_user")
    end

    describe "counts of profiles the viewer blocks" do
      let(:like_repo) { Hanami.app.slices[:post]["repositories.like_repository"] }
      let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
      let(:viewer) { create_account_with_profile(username: "counts_viewer") }
      let(:commenter) { create_account_with_profile(username: "counts_commenter") }
      let(:liker) { create_account_with_profile(username: "counts_liker") }
      let!(:post) { post_repo.create_post(author_profile_id: create_account_with_profile, content: "counted", visibility: "public") }

      before do
        comment_repo.create_comment(post_id: post.id, author_profile_id: commenter, content: "hi")
        like_repo.profile_like(post_id: post.id, profile_id: liker)
      end

      it "leaves them out of the comment and like counts" do
        blocks = Social::Slice["repositories.block_repository"]
        blocks.block(blocker_profile_id: viewer, blocked_profile_id: commenter)
        blocks.block(blocker_profile_id: viewer, blocked_profile_id: liker)

        proto = use_case.call(post_ids: [post.id], viewer_profile_id: viewer).fetch(post.id.to_s)

        expect([proto.comments_count, proto.likes_count]).to eq([0, 0])
      end

      it "keeps them for a viewer who blocks nobody and for no viewer" do
        [viewer, nil].each do |viewer_profile_id|
          proto = use_case.call(post_ids: [post.id], viewer_profile_id: viewer_profile_id).fetch(post.id.to_s)

          expect([proto.comments_count, proto.likes_count]).to eq([1, 1])
        end
      end
    end
  end
end
