# frozen_string_literal: true

require "spec_helper"
require "text"

RSpec.describe Text do
  describe ".blank?" do
    it "treats nil, empty and ASCII whitespace as blank" do
      expect(described_class.blank?(nil)).to be(true)
      expect(described_class.blank?("")).to be(true)
      expect(described_class.blank?(" \t\n ")).to be(true)
    end

    it "treats full-width and no-break spaces as blank" do
      expect(described_class.blank?("　　")).to be(true)
      expect(described_class.blank?("  　")).to be(true)
    end

    it "does not treat a value with any visible character as blank" do
      expect(described_class.blank?("　a")).to be(false)
      expect(described_class.blank?("a")).to be(false)
    end
  end

  describe ".strip" do
    it "removes surrounding full-width and ASCII whitespace" do
      expect(described_class.strip("　さくら　")).to eq("さくら")
      expect(described_class.strip(" \t さくら\n")).to eq("さくら")
    end

    it "keeps whitespace inside the value" do
      expect(described_class.strip("　さ　く　ら　")).to eq("さ　く　ら")
    end

    it "returns an empty string for nil" do
      expect(described_class.strip(nil)).to eq("")
    end
  end
end
