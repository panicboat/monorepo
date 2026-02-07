# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Favorites::AddFavorite do
  let(:use_case) { described_class.new(favorite_repo: favorite_repo) }
  let(:favorite_repo) { double(:favorite_repo) }

  let(:cast_id) { "cast-1" }
  let(:guest_id) { "guest-1" }

  describe "#call" do
    it "adds a favorite and returns success" do
      allow(favorite_repo).to receive(:add_favorite).with(cast_id: cast_id, guest_id: guest_id)

      result = use_case.call(cast_id: cast_id, guest_id: guest_id)

      expect(result[:success]).to be true
    end
  end
end
