# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Repositories::CommentRepository", type: :database do
  let(:repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }
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

  describe "#create_comment" do
    it "creates a top-level comment" do
      comment = repo.create_comment(post_id: post.id, user_id: user_id, content: "Nice post!")
      expect(comment).not_to be_nil
      expect(comment.content).to eq("Nice post!")
      expect(comment.parent_id).to be_nil
    end

    it "creates a reply to a comment" do
      parent = repo.create_comment(post_id: post.id, user_id: user_id, content: "Parent")
      reply = repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply", parent_id: parent.id)

      expect(reply.parent_id).to eq(parent.id)
    end

    it "increments parent replies_count when creating a reply" do
      parent = repo.create_comment(post_id: post.id, user_id: user_id, content: "Parent")
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply", parent_id: parent.id)

      updated_parent = repo.find_by_id(parent.id)
      expect(updated_parent.replies_count).to eq(1)
    end

    it "does not allow replying to a reply" do
      parent = repo.create_comment(post_id: post.id, user_id: user_id, content: "Parent")
      reply = repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply", parent_id: parent.id)
      nested = repo.create_comment(post_id: post.id, user_id: user_id, content: "Nested", parent_id: reply.id)

      expect(nested).to be_nil
    end
  end

  describe "#delete_comment" do
    it "deletes a comment by the owner" do
      comment = repo.create_comment(post_id: post.id, user_id: user_id, content: "To delete")
      result = repo.delete_comment(id: comment.id, user_id: user_id)

      expect(result).not_to be_nil
      expect(repo.find_by_id(comment.id)).to be_nil
    end

    it "does not delete a comment by non-owner" do
      comment = repo.create_comment(post_id: post.id, user_id: user_id, content: "Protected")
      other_user_id = create_user[:id]
      result = repo.delete_comment(id: comment.id, user_id: other_user_id)

      expect(result).to be_nil
      expect(repo.find_by_id(comment.id)).not_to be_nil
    end

    it "decrements parent replies_count when deleting a reply" do
      parent = repo.create_comment(post_id: post.id, user_id: user_id, content: "Parent")
      reply = repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply", parent_id: parent.id)

      repo.delete_comment(id: reply.id, user_id: user_id)
      updated_parent = repo.find_by_id(parent.id)
      expect(updated_parent.replies_count).to eq(0)
    end

    it "deletes replies when deleting a parent comment" do
      parent = repo.create_comment(post_id: post.id, user_id: user_id, content: "Parent")
      reply = repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply", parent_id: parent.id)

      repo.delete_comment(id: parent.id, user_id: user_id)
      expect(repo.find_by_id(reply.id)).to be_nil
    end
  end

  describe "#list_by_post_id" do
    it "returns only top-level comments" do
      parent = repo.create_comment(post_id: post.id, user_id: user_id, content: "Parent")
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply", parent_id: parent.id)

      comments = repo.list_by_post_id(post_id: post.id, limit: 10)
      expect(comments.size).to eq(1)
      expect(comments.first.content).to eq("Parent")
    end

    it "excludes comments from blocked users" do
      blocked_user_id = create_user[:id]
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Normal")
      repo.create_comment(post_id: post.id, user_id: blocked_user_id, content: "Blocked")

      comments = repo.list_by_post_id(post_id: post.id, limit: 10, exclude_user_ids: [blocked_user_id])
      expect(comments.size).to eq(1)
      expect(comments.first.content).to eq("Normal")
    end
  end

  describe "#list_replies" do
    it "returns replies for a comment" do
      parent = repo.create_comment(post_id: post.id, user_id: user_id, content: "Parent")
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply 1", parent_id: parent.id)
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply 2", parent_id: parent.id)

      replies = repo.list_replies(parent_id: parent.id, limit: 10)
      expect(replies.size).to eq(2)
    end
  end

  describe "#comments_count" do
    it "counts only top-level comments" do
      parent = repo.create_comment(post_id: post.id, user_id: user_id, content: "Parent")
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply", parent_id: parent.id)

      expect(repo.comments_count(post_id: post.id)).to eq(1)
    end

    it "excludes comments from specified users" do
      blocked_user_id = create_user[:id]
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Normal")
      repo.create_comment(post_id: post.id, user_id: blocked_user_id, content: "Blocked")

      expect(repo.comments_count(post_id: post.id, exclude_user_ids: [blocked_user_id])).to eq(1)
    end
  end

  describe "#comments_count_batch" do
    it "returns counts for multiple posts" do
      post2 = post_repo.create_post(cast_user_id: cast_id, content: "Post 2")
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Comment 1")
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Comment 2")
      repo.create_comment(post_id: post2.id, user_id: user_id, content: "Comment 3")

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
