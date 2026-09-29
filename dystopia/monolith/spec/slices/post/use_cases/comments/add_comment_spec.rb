# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::Comments::AddComment", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.comments.add_comment"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }
  let(:author_id) { SecureRandom.uuid_v7 }
  let(:user_id) { create_user[:id] }
  let(:post) { post_repo.create_post(author_id: author_id, content: "Test post") }

  def create_user(role: 1)
    id = SecureRandom.uuid_v7
    db[:identity__accounts].insert(
      id: id,
      role: role,
      created_at: Time.now,
      updated_at: Time.now
    )
    { id: id }
  end

  describe "#call" do
    context "when user does not exist" do
      it "raises UserNotFoundError" do
        non_existent_user_id = SecureRandom.uuid_v7

        expect {
          use_case.call(
            post_id: post.id,
            user_id: non_existent_user_id,
            content: "Test comment"
          )
        }.to raise_error(Post::UseCases::Comments::AddComment::UserNotFoundError)
      end
    end

    context "when user exists" do
      it "creates a comment successfully" do
        result = use_case.call(
          post_id: post.id,
          user_id: user_id,
          content: "Test comment"
        )

        expect(result[:comment]).not_to be_nil
        expect(result[:comment].content).to eq("Test comment")
        expect(result[:comment].user_id).to eq(user_id)
      end
    end

    context "when post does not exist" do
      it "raises PostNotFoundError" do
        expect {
          use_case.call(
            post_id: SecureRandom.uuid_v7,
            user_id: user_id,
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
            user_id: user_id,
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
          user_id: user_id,
          content: "",
          media: media
        )

        expect(result[:comment]).not_to be_nil
        expect(result[:comment].content).to eq("")
        expect(result[:comment].user_id).to eq(user_id)
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
            user_id: user_id,
            content: long_content
          )
        }.to raise_error(Post::UseCases::Comments::AddComment::ContentTooLongError)
      end
    end

    context "when content contains a mention" do
      let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
      let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

      it "saves the mention and notifies the mentioned account" do
        mentioned_id = SecureRandom.uuid_v7
        profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")

        result = use_case.call(post_id: post.id, user_id: user_id, content: "hi @mentioned_user")

        expect(result[:comment].comment_mentions.map(&:account_id)).to eq([mentioned_id])
        notifications = notification_repo.list(recipient_id: mentioned_id)
        expect(notifications.map(&:type)).to include("mention")
      end

      it "does not save a mention for an unresolved username" do
        result = use_case.call(post_id: post.id, user_id: user_id, content: "hi @nobody_here_xyz")

        expect(result[:comment].comment_mentions).to eq([])
      end

      it "does not notify a self-mention" do
        profile_repo.create(account_id: user_id, display_name: "Self", username: "self_user")

        use_case.call(post_id: post.id, user_id: user_id, content: "hi @self_user")

        expect(notification_repo.list(recipient_id: user_id)).to eq([])
      end

      it "does not notify a mentioned account that has blocked the commenter" do
        block_repo = Hanami.app.slices[:social]["repositories.block_repository"]
        mentioned_id = SecureRandom.uuid_v7
        profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")
        block_repo.block(blocker_id: mentioned_id, blocked_id: user_id)

        use_case.call(post_id: post.id, user_id: user_id, content: "hi @mentioned_user")

        expect(notification_repo.list(recipient_id: mentioned_id)).to eq([])
      end

      it "collapses repeated mentions of the same account into a single notification" do
        mentioned_id = SecureRandom.uuid_v7
        profile_repo.create(account_id: mentioned_id, display_name: "Mentioned", username: "mentioned_user")

        use_case.call(post_id: post.id, user_id: user_id, content: "@mentioned_user @mentioned_user")

        notifications = notification_repo.list(recipient_id: mentioned_id)
        expect(notifications.length).to eq(1)
        expect(notifications.first.actor_count).to eq(1)
      end
    end
  end
end
