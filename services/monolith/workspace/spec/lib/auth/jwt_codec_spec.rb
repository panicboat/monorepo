# frozen_string_literal: true

require "spec_helper"
require "auth/jwt_codec"

RSpec.describe Auth::JwtCodec do
  describe ".encode / .decode_sub" do
    it "roundtrips sub through encode and decode_sub" do
      token = described_class.encode(sub: "user-42", role: 1)
      expect(described_class.decode_sub(token)).to eq("user-42")
    end

    it "returns nil for a tampered token" do
      token = described_class.encode(sub: "user-42", role: 1)
      tampered = token[0..-5] + "XXXX"
      expect(described_class.decode_sub(tampered)).to be_nil
    end
  end
end
