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
  #   太郎 (id: "taro")   - follows Yuna(approved), Mio(approved), blocks Rin
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

    it "returns true when not blocked" do
      allow(social_adapter).to receive(:blocked?).and_return(false)

      result = policy.can_view_profile?(cast: yuna, viewer_guest_id: jiro_id)
      expect(result).to eq(true)
    end

    it "returns false when blocked" do
      allow(social_adapter).to receive(:blocked?)
        .with(guest_user_id: taro_id, cast_user_id: "rin-id")
        .and_return(true)

      result = policy.can_view_profile?(cast: rin, viewer_guest_id: taro_id)
      expect(result).to eq(false)
    end
  end

  describe "#can_view_profile_details? (plans, schedules)" do
    context "public cast (Yuna)" do
      it "returns true for unauthenticated user" do
        result = policy.can_view_profile_details?(cast: yuna, viewer_guest_id: nil)
        expect(result).to eq(true)
      end

      it "returns true for non-follower" do
        allow(social_adapter).to receive(:blocked?).and_return(false)

        result = policy.can_view_profile_details?(cast: yuna, viewer_guest_id: jiro_id)
        expect(result).to eq(true)
      end

      it "returns false when blocked" do
        allow(social_adapter).to receive(:blocked?).and_return(true)

        result = policy.can_view_profile_details?(cast: yuna, viewer_guest_id: taro_id)
        expect(result).to eq(false)
      end
    end

    context "private cast (Mio)" do
      it "returns false for unauthenticated user" do
        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: nil)
        expect(result).to eq(false)
      end

      it "returns false for non-follower" do
        allow(social_adapter).to receive(:blocked?).and_return(false)
        allow(social_adapter).to receive(:approved_follower?).and_return(false)

        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: jiro_id)
        expect(result).to eq(false)
      end

      it "returns false for pending follower" do
        allow(social_adapter).to receive(:blocked?).and_return(false)
        allow(social_adapter).to receive(:approved_follower?).and_return(false)

        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: saburo_id)
        expect(result).to eq(false)
      end

      it "returns true for approved follower" do
        allow(social_adapter).to receive(:blocked?).and_return(false)
        allow(social_adapter).to receive(:approved_follower?).and_return(true)

        result = policy.can_view_profile_details?(cast: mio, viewer_guest_id: taro_id)
        expect(result).to eq(true)
      end
    end
  end
end
