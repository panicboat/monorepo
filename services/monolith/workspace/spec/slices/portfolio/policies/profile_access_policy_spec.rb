# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::Policies::ProfileAccessPolicy do
  let(:policy) { described_class.new }
  let(:social_adapter) { instance_double(Portfolio::Adapters::SocialAdapter) }

  before do
    allow(Portfolio::Adapters::SocialAdapter).to receive(:new).and_return(social_adapter)
  end

  # =============================================================================
  # Test Data Setup (mirrors seeds.rb visibility matrix)
  # =============================================================================
  #
  # Casts:
  #   Yuna (public)  - visibility: "public"
  #   Mio  (private) - visibility: "private"
  #   Rin  (public)  - visibility: "public"
  #
  # Guests:
  #   太郎 (id: "taro")   - follows Yuna(approved), Mio(approved)
  #   次郎 (id: "jiro")   - no follows
  #   三郎 (id: "saburo") - follows Mio(pending)
  # =============================================================================

  # Casts
  let(:yuna) { double(:cast, user_id: "yuna-id", visibility: "public") }
  let(:mio) { double(:cast, user_id: "mio-id", visibility: "private") }
  let(:rin) { double(:cast, user_id: "rin-id", visibility: "public") }

  # Guest IDs
  let(:taro_id) { "taro-guest-id" }
  let(:jiro_id) { "jiro-guest-id" }
  let(:saburo_id) { "saburo-guest-id" }

  describe "#can_view_profile?" do
    it "returns true for unauthenticated user" do
      result = policy.can_view_profile?(cast: yuna, viewer_guest_id: nil)
      expect(result).to eq(true)
    end

    it "returns true for authenticated user" do
      result = policy.can_view_profile?(cast: yuna, viewer_guest_id: jiro_id)
      expect(result).to eq(true)
    end
  end

  describe "#can_view_profile? (with cast-blocked-guest)" do
    it "returns true even when cast blocked the guest (basic profile always visible)" do
      allow(social_adapter).to receive(:cast_blocked_guest?)
        .with(cast_user_id: "yuna-id", guest_user_id: jiro_id)
        .and_return(true)

      result = policy.can_view_profile?(cast: yuna, viewer_guest_id: jiro_id)
      expect(result).to eq(true)
    end
  end

  describe "#can_view_profile_details? with cast-to-guest block" do
    context "public cast (Yuna) blocks guest" do
      it "returns false when cast blocked the guest" do
        allow(social_adapter).to receive(:cast_blocked_guest?)
          .with(cast_user_id: "yuna-id", guest_user_id: jiro_id)
          .and_return(true)

        result = policy.can_view_profile_details?(cast: yuna, viewer_guest_id: jiro_id)
        expect(result).to eq(false)
      end
    end

    context "private cast (Mio) blocks approved follower" do
      it "returns false when cast blocked the guest even if approved follower" do
        allow(social_adapter).to receive(:cast_blocked_guest?)
          .with(cast_user_id: "mio-id", guest_user_id: taro_id)
          .and_return(true)

        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: taro_id)
        expect(result).to eq(false)
      end
    end
  end

  describe "#can_view_profile_details? (plans, schedules)" do
    before do
      allow(social_adapter).to receive(:cast_blocked_guest?).and_return(false)
    end

    context "public cast (Yuna)" do
      it "returns true for unauthenticated user" do
        result = policy.can_view_profile_details?(cast: yuna, viewer_guest_id: nil)
        expect(result).to eq(true)
      end

      it "returns true for non-follower" do
        result = policy.can_view_profile_details?(cast: yuna, viewer_guest_id: jiro_id)
        expect(result).to eq(true)
      end
    end

    context "private cast (Mio)" do
      it "returns false for unauthenticated user" do
        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: nil)
        expect(result).to eq(false)
      end

      it "returns false for non-follower" do
        allow(social_adapter).to receive(:approved_follower?).and_return(false)

        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: jiro_id)
        expect(result).to eq(false)
      end

      it "returns false for pending follower" do
        allow(social_adapter).to receive(:approved_follower?).and_return(false)

        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: saburo_id)
        expect(result).to eq(false)
      end

      it "returns true for approved follower" do
        allow(social_adapter).to receive(:approved_follower?).and_return(true)

        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: taro_id)
        expect(result).to eq(true)
      end
    end
  end
end
