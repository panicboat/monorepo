# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Comments::AddComment do
  let(:use_case) { described_class.new(comment_repo: comment_repo, post_repo: post_repo) }
  let(:comment_repo) { double(:comment_repo) }
  let(:post_repo) { double(:post_repo) }

  let(:post_id) { "post-1" }
  let(:user_id) { "user-1" }
  let(:content) { "Great post!" }
  let(:post) { double(:post, id: post_id) }
  let(:comment) { double(:comment, id: "comment-1", post_id: post_id) }

  describe "#call" do
    context "when creating a top-level comment" do
      it "creates a comment and returns it with post_id" do
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)
        allow(comment_repo).to receive(:create_comment).with(
          post_id: post_id,
          user_id: user_id,
          content: content,
          parent_id: nil,
          media: []
        ).and_return(comment)

        result = use_case.call(post_id: post_id, user_id: user_id, content: content)

        expect(result[:comment]).to eq(comment)
        expect(result[:post_id]).to eq(post_id)
      end
    end

    context "when creating a reply" do
      let(:parent_id) { "parent-1" }
      let(:parent) { double(:parent, id: parent_id, parent_id: nil) }

      it "creates a reply to an existing comment" do
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)
        allow(comment_repo).to receive(:find_by_id).with(parent_id).and_return(parent)
        allow(comment_repo).to receive(:create_comment).and_return(comment)

        result = use_case.call(
          post_id: post_id,
          user_id: user_id,
          content: content,
          parent_id: parent_id
        )

        expect(result[:comment]).to eq(comment)
        expect(result[:post_id]).to eq(post_id)
      end

      it "raises ParentNotFoundError when parent does not exist" do
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)
        allow(comment_repo).to receive(:find_by_id).with(parent_id).and_return(nil)

        expect {
          use_case.call(post_id: post_id, user_id: user_id, content: content, parent_id: parent_id)
        }.to raise_error(described_class::ParentNotFoundError)
      end

      it "raises CannotReplyToReplyError when parent is a reply" do
        reply_parent = double(:reply_parent, id: parent_id, parent_id: "grandparent-1")
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)
        allow(comment_repo).to receive(:find_by_id).with(parent_id).and_return(reply_parent)

        expect {
          use_case.call(post_id: post_id, user_id: user_id, content: content, parent_id: parent_id)
        }.to raise_error(described_class::CannotReplyToReplyError)
      end
    end

    context "with media" do
      let(:media) { [{ media_type: "image", url: "http://example.com/img.jpg" }] }

      it "creates a comment with media" do
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)
        allow(comment_repo).to receive(:create_comment).with(
          post_id: post_id,
          user_id: user_id,
          content: content,
          parent_id: nil,
          media: [{ media_type: "image", url: "http://example.com/img.jpg", thumbnail_url: nil }]
        ).and_return(comment)

        result = use_case.call(post_id: post_id, user_id: user_id, content: content, media: media)

        expect(result[:comment]).to eq(comment)
        expect(result[:post_id]).to eq(post_id)
      end

      it "raises TooManyMediaError when media exceeds limit" do
        too_many_media = Array.new(4) { { media_type: "image", url: "http://example.com/img.jpg" } }
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)

        expect {
          use_case.call(post_id: post_id, user_id: user_id, content: content, media: too_many_media)
        }.to raise_error(described_class::TooManyMediaError)
      end
    end

    context "validation errors" do
      it "raises PostNotFoundError when post does not exist" do
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(nil)

        expect {
          use_case.call(post_id: post_id, user_id: user_id, content: content)
        }.to raise_error(described_class::PostNotFoundError)
      end

      it "raises EmptyContentError when content is empty" do
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)

        expect {
          use_case.call(post_id: post_id, user_id: user_id, content: "")
        }.to raise_error(described_class::EmptyContentError)
      end

      it "raises EmptyContentError when content is whitespace only" do
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)

        expect {
          use_case.call(post_id: post_id, user_id: user_id, content: "   ")
        }.to raise_error(described_class::EmptyContentError)
      end

      it "raises ContentTooLongError when content exceeds 1000 characters" do
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)
        long_content = "a" * 1001

        expect {
          use_case.call(post_id: post_id, user_id: user_id, content: long_content)
        }.to raise_error(described_class::ContentTooLongError)
      end

      it "raises CreateFailedError when repository returns nil" do
        allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)
        allow(comment_repo).to receive(:create_comment).and_return(nil)

        expect {
          use_case.call(post_id: post_id, user_id: user_id, content: content)
        }.to raise_error(described_class::CreateFailedError)
      end
    end
  end
end
