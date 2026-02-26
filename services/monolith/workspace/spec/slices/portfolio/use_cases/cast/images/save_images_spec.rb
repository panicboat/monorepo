# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Images::SaveImages do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  describe "#call" do
    let(:cast_user_id) { SecureRandom.uuid }
    let(:profile_media_id) { SecureRandom.uuid }
    let(:gallery_media_ids) { [SecureRandom.uuid, SecureRandom.uuid] }
    let(:avatar_media_id) { SecureRandom.uuid }
    let(:cast) { double(:cast) }

    it "saves images and returns cast" do
      expect(repo).to receive(:save_images).with(
        user_id: cast_user_id,
        profile_media_id: profile_media_id,
        gallery_media_ids: gallery_media_ids,
        avatar_media_id: nil
      )
      expect(repo).to receive(:find_with_plans).with(cast_user_id).and_return(cast)

      result = use_case.call(cast_user_id: cast_user_id, profile_media_id: profile_media_id, gallery_media_ids: gallery_media_ids)
      expect(result).to eq(cast)
    end

    it "saves images with avatar_media_id" do
      expect(repo).to receive(:save_images).with(
        user_id: cast_user_id,
        profile_media_id: profile_media_id,
        gallery_media_ids: gallery_media_ids,
        avatar_media_id: avatar_media_id
      )
      expect(repo).to receive(:find_with_plans).with(cast_user_id).and_return(cast)

      result = use_case.call(
        cast_user_id: cast_user_id,
        profile_media_id: profile_media_id,
        gallery_media_ids: gallery_media_ids,
        avatar_media_id: avatar_media_id
      )
      expect(result).to eq(cast)
    end
  end
end
