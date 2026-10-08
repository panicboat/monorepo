# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::Comments::AddComment", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.comments.add_comment"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
  let(:author_profile_id) { create_account_with_profile }
  let(:author_profile_id) { create_account_with_profile(display_name: "Self", username: "self_user") }
  let(:post) { post_repo.create_post(author_profile_id: author_profile_id, content: "Test post") }

  describe "#call" do
    context "when user does not exist" do
      it "raises UserNotFoundError" do
        non_existent_author_profile_id = SecureRandom.uuid_v7

        expect {
          use_case.call(
            post_id: post.id,
            author_profile_id: non_existent_author_profile_id,
            content: "Test comment"
          )
        }.to raise_error(Post::UseCases::Comments::AddComment::UserNotFoundError)
      end
    end

    context "when user exists" do
      it "creates a comment successfully" do
        result = use_case.call(
          post_id: post.id,
          author_profile_id: author_profile_id,
          content: "Test comment"
        )

        expect(result[:comment]).not_to be_nil
        expect(result[:comment].content).to eq("Test comment")
        expect(result[:comment].author_profile_id).to eq(author_profile_id)
      end
    end

    context "when post does not exist" do
      it "raises PostNotFoundError" do
        expect {
          use_case.call(
            post_id: SecureRandom.uuid_v7,
            author_profile_id: author_profile_id,
            content: "Test comment"
          )
        }.to raise_error(Post::UseCases::Comments::AddComment::PostNotFoundError)
      end
    end

    context "when content and media are both empty" do
      it "raises EmptyContentError" do
        expect {
          use_case.call(
            post_id: post.id,
            author_profile_id: author_profile_id,
            content: "",
            media: []
          )
        }.to raise_error(Post::UseCases::Comments::AddComment::EmptyContentError)
      end
    end

    context "when only media is provided (no content)" do
      it "creates a comment successfully with media_id" do
        media_id = SecureRandom.uuid_v7
        media = [{ media_id: media_id, media_type: "image" }]

        result = use_case.call(
          post_id: post.id,
          author_profile_id: author_profile_id,
          content: "",
          media: media
        )

        expect(result[:comment]).not_to be_nil
        expect(result[:comment].content).to eq("")
        expect(result[:comment].author_profile_id).to eq(author_profile_id)
        expect(result[:comment].comment_media).not_to be_empty
        expect(result[:comment].comment_media.first.media_id).to eq(media_id)
      end
    end

    context "when content is too long" do
      it "raises ContentTooLongError" do
        long_content = "a" * 1001

        expect {
          use_case.call(
            post_id: post.id,
            author_profile_id: author_profile_id,
            content: long_content
          )
        }.to raise_error(Post::UseCases::Comments::AddComment::ContentTooLongError)
      end
    end

    context "when content contains a mention" do
      let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
      it "saves the mention and notifies the mentioned profile" do
        mentioned_id = create_account_with_profile(display_name: "Mentioned", username: "mentioned_user")

        result = use_case.call(post_id: post.id, author_profile_id: author_profile_id, content: "hi @mentioned_user")

        expect(result[:comment].comment_mentions.map(&:profile_id)).to eq([mentioned_id])
        notifications = notification_repo.list(recipient_id: mentioned_id)
        expect(notifications.map(&:type)).to include("mention")
      end

      it "normalizes content before saving mentions" do
        mentioned_id = create_account_with_profile(display_name: "Mentioned", username: "mentioned_user")

        result = use_case.call(post_id: post.id, author_profile_id: author_profile_id, content: "\n@mentioned_user hi")

        expect(result[:comment].content).to eq("@mentioned_user hi")
        expect(result[:comment].comment_mentions.first.position).to eq(0)
      end

      it "does not save a mention for an unresolved username" do
        result = use_case.call(post_id: post.id, author_profile_id: author_profile_id, content: "hi @nobody_here_xyz")

        expect(result[:comment].comment_mentions).to eq([])
      end

      it "does not notify a self-mention" do
        use_case.call(post_id: post.id, author_profile_id: author_profile_id, content: "hi @self_user")

        expect(notification_repo.list(recipient_id: author_profile_id)).to eq([])
      end

      it "does not notify a mentioned profile that has blocked the commenter" do
        block_repo = Hanami.app.slices[:social]["repositories.block_repository"]
        mentioned_id = create_account_with_profile(display_name: "Mentioned", username: "mentioned_user")
        block_repo.block(blocker_id: mentioned_id, blocked_id: author_profile_id)

        use_case.call(post_id: post.id, author_profile_id: author_profile_id, content: "hi @mentioned_user")

        expect(notification_repo.list(recipient_id: mentioned_id)).to eq([])
      end

      it "collapses repeated mentions of the same profile into a single notification" do
        mentioned_id = create_account_with_profile(display_name: "Mentioned", username: "mentioned_user")

        use_case.call(post_id: post.id, author_profile_id: author_profile_id, content: "@mentioned_user @mentioned_user")

        notifications = notification_repo.list(recipient_id: mentioned_id)
        expect(notifications.length).to eq(1)
        expect(notifications.first.actor_count).to eq(1)
      end

      it "saves and notifies mentions in replies" do
        mentioned_id = create_account_with_profile(display_name: "Mentioned", username: "mentioned_user")
        parent = comment_repo.create_comment(post_id: post.id, author_profile_id: create_account_with_profile, content: "Parent")

        result = use_case.call(
          post_id: post.id,
          author_profile_id: author_profile_id,
          content: "hi @mentioned_user",
          parent_id: parent.id
        )

        expect(result[:comment].comment_mentions.map(&:profile_id)).to eq([mentioned_id])
        notifications = notification_repo.list(recipient_id: mentioned_id)
        expect(notifications.map(&:type)).to include("mention")
      end
    end
  end
end
