# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::Relations::PostLikes", type: :database do
  let(:db) { Hanami.app.slices[:social]["db.rom"].gateways[:default].connection }
  let(:post_repo) { Hanami.app.slices[:social]["repositories.post_repository"] }
  let(:cast_id) { SecureRandom.uuid }
  let(:guest_id) { SecureRandom.uuid }
  let(:post) { post_repo.create_post(cast_id: cast_id, content: "Test post") }

  describe "table structure" do
    it "can insert a like record" do
      db[:post__likes].insert(
        post_id: post.id,
        guest_id: guest_id,
        created_at: Time.now
      )

      like = db[:post__likes].where(post_id: post.id, guest_id: guest_id).first
      expect(like).not_to be_nil
      expect(like[:post_id]).to eq(post.id)
      expect(like[:guest_id]).to eq(guest_id)
    end

    it "enforces unique constraint on post_id and guest_id" do
      db[:post__likes].insert(
        post_id: post.id,
        guest_id: guest_id,
        created_at: Time.now
      )

      expect {
        db[:post__likes].insert(
          post_id: post.id,
          guest_id: guest_id,
          created_at: Time.now
        )
      }.to raise_error(Sequel::UniqueConstraintViolation)
    end
  end
end
