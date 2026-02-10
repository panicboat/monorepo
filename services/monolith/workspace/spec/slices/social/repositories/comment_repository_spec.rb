# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::Repositories::CommentRepository", type: :database do
  let(:repo) { Hanami.app.slices[:social]["repositories.comment_repository"] }
  let(:post_repo) { Hanami.app.slices[:social]["repositories.post_repository"] }
  let(:db) { Hanami.app.slices[:social]["db.rom"].gateways[:default].connection }

  let(:cast_id) { SecureRandom.uuid }
  let(:user_id) { create_user[:id] }
  let(:post) { post_repo.create_post(cast_id: cast_id, content: "Test post") }

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
    it "creates a comment and returns it" do
      comment = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Great post!"
      )

      expect(comment.post_id).to eq(post.id)
      expect(comment.user_id).to eq(user_id)
      expect(comment.content).to eq("Great post!")
      expect(comment.parent_id).to be_nil
      expect(comment.replies_count).to eq(0)
      expect(comment.id).not_to be_nil
    end

    it "creates a reply to a comment" do
      parent = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Parent comment"
      )

      reply = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Reply comment",
        parent_id: parent.id
      )

      expect(reply.parent_id).to eq(parent.id)

      # Check parent's replies_count was incremented
      updated_parent = repo.find_by_id(parent.id)
      expect(updated_parent.replies_count).to eq(1)
    end

    it "returns nil when trying to reply to a reply" do
      parent = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Parent comment"
      )

      reply = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Reply",
        parent_id: parent.id
      )

      nested_reply = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Nested reply",
        parent_id: reply.id
      )

      expect(nested_reply).to be_nil
    end

    it "creates a comment with media" do
      media = [
        { media_type: "image", url: "http://example.com/img.jpg", thumbnail_url: "" }
      ]

      comment = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "With media",
        media: media
      )

      result = repo.find_by_id(comment.id)
      expect(result.comment_media.size).to eq(1)
      expect(result.comment_media.first.media_type).to eq("image")
    end
  end

  describe "#delete_comment" do
    it "deletes a comment owned by the user" do
      comment = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "To delete"
      )

      result = repo.delete_comment(id: comment.id, user_id: user_id)

      expect(result[:post_id]).to eq(post.id)
      expect(result[:deleted_count]).to eq(1)
      expect(repo.find_by_id(comment.id)).to be_nil
    end

    it "returns nil when comment does not exist" do
      result = repo.delete_comment(id: SecureRandom.uuid, user_id: user_id)
      expect(result).to be_nil
    end

    it "returns nil when user is not the owner" do
      comment = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Not yours"
      )

      other_user = create_user[:id]
      result = repo.delete_comment(id: comment.id, user_id: other_user)

      expect(result).to be_nil
      expect(repo.find_by_id(comment.id)).not_to be_nil
    end

    it "deletes replies when deleting a parent comment" do
      parent = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Parent"
      )

      repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Reply 1",
        parent_id: parent.id
      )

      repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Reply 2",
        parent_id: parent.id
      )

      result = repo.delete_comment(id: parent.id, user_id: user_id)

      expect(result[:deleted_count]).to eq(3)
    end

    it "decrements parent replies_count when deleting a reply" do
      parent = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Parent"
      )

      reply = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Reply",
        parent_id: parent.id
      )

      expect(repo.find_by_id(parent.id).replies_count).to eq(1)

      repo.delete_comment(id: reply.id, user_id: user_id)

      expect(repo.find_by_id(parent.id).replies_count).to eq(0)
    end
  end

  describe "#find_by_id" do
    it "returns nil when comment does not exist" do
      expect(repo.find_by_id(SecureRandom.uuid)).to be_nil
    end

    it "returns comment with media when exists" do
      comment = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Test"
      )

      result = repo.find_by_id(comment.id)
      expect(result).not_to be_nil
      expect(result.content).to eq("Test")
    end
  end

  describe "#list_by_post_id" do
    before do
      base_time = Time.parse("2026-01-01T10:00:00Z")
      3.times do |i|
        db[:social__post_comments].insert(
          id: SecureRandom.uuid,
          post_id: post.id,
          user_id: user_id,
          content: "Comment #{i}",
          parent_id: nil,
          replies_count: 0,
          created_at: base_time + (i * 60)
        )
      end
    end

    it "returns top-level comments ordered by created_at desc" do
      comments = repo.list_by_post_id(post_id: post.id, limit: 10)
      expect(comments.size).to eq(3)
      expect(comments.first.content).to eq("Comment 2")
    end

    it "limits results (returns limit + 1 for has_more detection)" do
      comments = repo.list_by_post_id(post_id: post.id, limit: 2)
      expect(comments.size).to eq(3)
    end

    it "does not return replies" do
      parent = repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Parent"
      )

      repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Reply",
        parent_id: parent.id
      )

      comments = repo.list_by_post_id(post_id: post.id, limit: 100)
      expect(comments.map(&:parent_id).compact).to be_empty
    end
  end

  describe "#list_replies" do
    let(:parent) do
      repo.create_comment(
        post_id: post.id,
        user_id: user_id,
        content: "Parent"
      )
    end

    before do
      base_time = Time.parse("2026-01-01T10:00:00Z")
      3.times do |i|
        db[:social__post_comments].insert(
          id: SecureRandom.uuid,
          post_id: post.id,
          user_id: user_id,
          content: "Reply #{i}",
          parent_id: parent.id,
          replies_count: 0,
          created_at: base_time + (i * 60)
        )
      end
    end

    it "returns replies ordered by created_at desc" do
      replies = repo.list_replies(parent_id: parent.id, limit: 10)
      expect(replies.size).to eq(3)
      expect(replies.first.content).to eq("Reply 2")
    end

    it "limits results (returns limit + 1 for has_more detection)" do
      replies = repo.list_replies(parent_id: parent.id, limit: 2)
      expect(replies.size).to eq(3)
    end
  end

  describe "#comments_count" do
    it "returns count of top-level comments" do
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Comment 1")
      parent = repo.create_comment(post_id: post.id, user_id: user_id, content: "Comment 2")
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Reply", parent_id: parent.id)

      expect(repo.comments_count(post_id: post.id)).to eq(2)
    end

    it "excludes comments from specified user IDs" do
      other_user = create_user[:id]
      repo.create_comment(post_id: post.id, user_id: user_id, content: "Comment 1")
      repo.create_comment(post_id: post.id, user_id: other_user, content: "Comment 2")
      repo.create_comment(post_id: post.id, user_id: other_user, content: "Comment 3")

      expect(repo.comments_count(post_id: post.id)).to eq(3)
      expect(repo.comments_count(post_id: post.id, exclude_user_ids: [other_user])).to eq(1)
    end
  end

  describe "#comments_count_batch" do
    it "returns counts for multiple posts" do
      post2 = post_repo.create_post(cast_id: cast_id, content: "Post 2")

      repo.create_comment(post_id: post.id, user_id: user_id, content: "C1")
      repo.create_comment(post_id: post.id, user_id: user_id, content: "C2")
      repo.create_comment(post_id: post2.id, user_id: user_id, content: "C3")

      counts = repo.comments_count_batch(post_ids: [post.id, post2.id])

      expect(counts[post.id]).to eq(2)
      expect(counts[post2.id]).to eq(1)
    end

    it "returns empty hash for empty input" do
      expect(repo.comments_count_batch(post_ids: [])).to eq({})
      expect(repo.comments_count_batch(post_ids: nil)).to eq({})
    end

    it "excludes comments from specified user IDs" do
      other_user = create_user[:id]
      post2 = post_repo.create_post(cast_id: cast_id, content: "Post 2")

      repo.create_comment(post_id: post.id, user_id: user_id, content: "C1")
      repo.create_comment(post_id: post.id, user_id: other_user, content: "C2")
      repo.create_comment(post_id: post2.id, user_id: other_user, content: "C3")

      counts = repo.comments_count_batch(post_ids: [post.id, post2.id], exclude_user_ids: [other_user])

      expect(counts[post.id]).to eq(1)
      expect(counts[post2.id]).to be_nil # No comments left after exclusion
    end
  end
end
