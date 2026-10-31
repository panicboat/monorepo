# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Repositories::CommentRepository", type: :database do
  let(:repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:post_author_profile_id) { SecureRandom.uuid_v7 }
  let(:author_profile_id) { SecureRandom.uuid_v7 }
  let(:post) { post_repo.create_post(author_profile_id: post_author_profile_id, content: "Test post") }

  describe "#create_comment" do
    it "creates a top-level comment" do
      comment = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Nice post!")
      expect(comment).not_to be_nil
      expect(comment.content).to eq("Nice post!")
      expect(comment.parent_id).to be_nil
    end

    it "creates a reply to a comment" do
      parent = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Parent")
      reply = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Reply", parent_id: parent.id)

      expect(reply.parent_id).to eq(parent.id)
    end

    it "increments parent replies_count when creating a reply" do
      parent = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Parent")
      repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Reply", parent_id: parent.id)

      updated_parent = repo.find_by_id(parent.id)
      expect(updated_parent.replies_count).to eq(1)
    end

    it "does not allow replying to a reply" do
      parent = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Parent")
      reply = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Reply", parent_id: parent.id)
      nested = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Nested", parent_id: reply.id)

      expect(nested).to be_nil
    end

    describe "#create_comment with mentions" do
      it "saves mentions alongside the comment" do
        mentioned_id = SecureRandom.uuid_v7

        comment = repo.create_comment(
          post_id: post.id,
          author_profile_id: author_profile_id,
          content: "@alice hi",
          mentions: [{ profile_id: mentioned_id, position: 0, length: 6 }]
        )

        expect(comment.comment_mentions.length).to eq(1)
        expect(comment.comment_mentions.first.profile_id).to eq(mentioned_id)
      end

      it "creates a comment with no mentions when the array is empty" do
        comment = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "hi")

        expect(comment.comment_mentions).to eq([])
      end
    end
  end

  describe "#delete_comment" do
    it "deletes a comment by the owner" do
      comment = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "To delete")
      result = repo.delete_comment(id: comment.id, author_profile_id: author_profile_id)

      expect(result).not_to be_nil
      expect(repo.find_by_id(comment.id)).to be_nil
    end

    it "does not delete a comment by non-owner" do
      comment = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Protected")
      other_author_profile_id = SecureRandom.uuid_v7
      result = repo.delete_comment(id: comment.id, author_profile_id: other_author_profile_id)

      expect(result).to be_nil
      expect(repo.find_by_id(comment.id)).not_to be_nil
    end

    it "decrements parent replies_count when deleting a reply" do
      parent = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Parent")
      reply = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Reply", parent_id: parent.id)

      repo.delete_comment(id: reply.id, author_profile_id: author_profile_id)
      updated_parent = repo.find_by_id(parent.id)
      expect(updated_parent.replies_count).to eq(0)
    end

    it "deletes replies when deleting a parent comment" do
      parent = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Parent")
      reply = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Reply", parent_id: parent.id)

      repo.delete_comment(id: parent.id, author_profile_id: author_profile_id)
      expect(repo.find_by_id(reply.id)).to be_nil
    end
  end

  describe "#list_by_post_id" do
    it "returns only top-level comments" do
      parent = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Parent")
      repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Reply", parent_id: parent.id)

      comments = repo.list_by_post_id(post_id: post.id, limit: 10)
      expect(comments.size).to eq(1)
      expect(comments.first.content).to eq("Parent")
    end

    it "excludes comments from blocked users" do
      blocked_author_profile_id = SecureRandom.uuid_v7
      repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Normal")
      repo.create_comment(post_id: post.id, author_profile_id: blocked_author_profile_id, content: "Blocked")

      comments = repo.list_by_post_id(post_id: post.id, limit: 10, exclude_author_profile_ids: [blocked_author_profile_id])
      expect(comments.size).to eq(1)
      expect(comments.first.content).to eq("Normal")
    end
  end

  describe "#list_replies" do
    it "returns replies for a comment" do
      parent = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Parent")
      repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Reply 1", parent_id: parent.id)
      repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Reply 2", parent_id: parent.id)

      replies = repo.list_replies(parent_id: parent.id, limit: 10)
      expect(replies.size).to eq(2)
    end
  end

  describe "#comments_count" do
    it "counts only top-level comments" do
      parent = repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Parent")
      repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Reply", parent_id: parent.id)

      expect(repo.comments_count(post_id: post.id)).to eq(1)
    end

    it "excludes comments from specified users" do
      blocked_author_profile_id = SecureRandom.uuid_v7
      repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Normal")
      repo.create_comment(post_id: post.id, author_profile_id: blocked_author_profile_id, content: "Blocked")

      expect(repo.comments_count(post_id: post.id, exclude_author_profile_ids: [blocked_author_profile_id])).to eq(1)
    end
  end

  describe "#comments_count_batch" do
    it "returns counts for multiple posts" do
      post2 = post_repo.create_post(author_profile_id: post_author_profile_id, content: "Post 2")
      repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Comment 1")
      repo.create_comment(post_id: post.id, author_profile_id: author_profile_id, content: "Comment 2")
      repo.create_comment(post_id: post2.id, author_profile_id: author_profile_id, content: "Comment 3")

      counts = repo.comments_count_batch(post_ids: [post.id, post2.id])
      expect(counts[post.id]).to eq(2)
      expect(counts[post2.id]).to eq(1)
    end

    it "returns empty hash for empty input" do
      expect(repo.comments_count_batch(post_ids: [])).to eq({})
      expect(repo.comments_count_batch(post_ids: nil)).to eq({})
    end
  end
end
