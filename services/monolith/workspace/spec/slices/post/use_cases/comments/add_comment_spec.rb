# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::Comments::AddComment", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.comments.add_comment"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }
  let(:cast_id) { SecureRandom.uuid }
  let(:user_id) { create_user[:id] }
  let(:post) { post_repo.create_post(cast_user_id: cast_id, content: "Test post") }

  def create_user(role: 1)
    id = SecureRandom.uuid
    db[:identity__users].insert(
      id: id,
      phone_number: "090#{rand(10000000..99999999)}",
      password_digest: "$2a$12$K0ByB.6YI2/OYrB4fQOYLe6Tv0datUVf6VZ/2Jzwm879BW5K1cHey",
      role: role,
      created_at: Time.now,
      updated_at: Time.now
    )
    { id: id }
  end

  describe "#call" do
    context "when user does not exist" do
      it "raises UserNotFoundError" do
        non_existent_user_id = SecureRandom.uuid

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
            post_id: SecureRandom.uuid,
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
        media_id = SecureRandom.uuid
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
  end
end
