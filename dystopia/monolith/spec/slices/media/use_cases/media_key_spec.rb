# frozen_string_literal: true

require "spec_helper"

RSpec.describe Media::UseCases::MediaKey do
  describe ".prefix_for" do
    let(:profile_id) { SecureRandom.uuid_v7 }

    it "returns the prefix that every key issued to the profile starts with" do
      key = described_class.for(profile_id: profile_id, media_id: SecureRandom.uuid_v7, extension: ".jpg")

      expect(described_class.prefix_for(profile_id: profile_id)).to eq("media/#{profile_id}/")
      expect(key).to start_with(described_class.prefix_for(profile_id: profile_id))
    end

    it "refuses an empty profile id, whose prefix would cover every profile" do
      expect { described_class.prefix_for(profile_id: "") }.to raise_error(ArgumentError)
      expect { described_class.prefix_for(profile_id: nil) }.to raise_error(ArgumentError)
    end
  end
end
