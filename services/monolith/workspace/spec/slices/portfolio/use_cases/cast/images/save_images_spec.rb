# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Images::SaveImages do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  describe "#call" do
    let(:cast_id) { 1 }
    let(:image_path) { "casts/1/profile.jpg" }
    let(:images) { ["casts/1/gallery/1.jpg", "casts/1/gallery/2.jpg"] }
    let(:cast) { double(:cast) }

    it "saves images and returns cast" do
      expect(repo).to receive(:save_images).with(id: cast_id, image_path: image_path, images: images, avatar_path: nil)
      expect(repo).to receive(:find_with_plans).with(cast_id).and_return(cast)

      result = use_case.call(cast_id: cast_id, image_path: image_path, images: images)
      expect(result).to eq(cast)
    end
  end
end
