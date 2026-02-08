# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::Relations::CastFollows", type: :database do
  let(:db) { Hanami.app.slices[:social]["db.rom"].gateways[:default].connection }
  let(:cast_id) { SecureRandom.uuid }
  let(:guest_id) { SecureRandom.uuid }

  describe "table structure" do
    it "can insert a follow record with status" do
      db[:social__cast_follows].insert(
        cast_id: cast_id,
        guest_id: guest_id,
        status: "approved",
        created_at: Time.now
      )

      follow = db[:social__cast_follows].where(cast_id: cast_id, guest_id: guest_id).first
      expect(follow).not_to be_nil
      expect(follow[:cast_id]).to eq(cast_id)
      expect(follow[:guest_id]).to eq(guest_id)
      expect(follow[:status]).to eq("approved")
    end

    it "can insert a pending follow request" do
      db[:social__cast_follows].insert(
        cast_id: cast_id,
        guest_id: guest_id,
        status: "pending",
        created_at: Time.now
      )

      follow = db[:social__cast_follows].where(cast_id: cast_id, guest_id: guest_id).first
      expect(follow[:status]).to eq("pending")
    end

    it "enforces unique constraint on cast_id and guest_id" do
      db[:social__cast_follows].insert(
        cast_id: cast_id,
        guest_id: guest_id,
        status: "approved",
        created_at: Time.now
      )

      expect {
        db[:social__cast_follows].insert(
          cast_id: cast_id,
          guest_id: guest_id,
          status: "approved",
          created_at: Time.now
        )
      }.to raise_error(Sequel::UniqueConstraintViolation)
    end
  end
end
