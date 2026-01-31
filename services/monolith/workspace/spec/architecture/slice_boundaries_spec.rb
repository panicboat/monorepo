# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Slice Boundaries" do
  describe "Social slice" do
    let(:social_files) do
      Dir.glob(File.join(Monolith::App.root, "slices/social/**/*.rb"))
    end

    it "does not directly access Portfolio::Slice" do
      violations = []

      social_files.each do |file|
        content = File.read(file)
        if content.include?("Portfolio::Slice[")
          violations << file.sub(Monolith::App.root.to_s + "/", "")
        end
      end

      expect(violations).to be_empty,
        "Social slice should not directly access Portfolio::Slice.\n" \
        "Use SharedServices::CastLookupService instead.\n" \
        "Violations found in:\n  #{violations.join("\n  ")}"
    end

    it "does not directly access Portfolio repositories" do
      violations = []

      social_files.each do |file|
        content = File.read(file)
        if content.match?(/Portfolio::(Repositories|DB|Structs)::/)
          violations << file.sub(Monolith::App.root.to_s + "/", "")
        end
      end

      expect(violations).to be_empty,
        "Social slice should not directly access Portfolio internals.\n" \
        "Use SharedServices instead.\n" \
        "Violations found in:\n  #{violations.join("\n  ")}"
    end
  end

  describe "Identity slice" do
    let(:identity_files) do
      Dir.glob(File.join(Monolith::App.root, "slices/identity/**/*.rb"))
    end

    it "does not directly access Portfolio::Slice" do
      violations = []

      identity_files.each do |file|
        content = File.read(file)
        if content.include?("Portfolio::Slice[")
          violations << file.sub(Monolith::App.root.to_s + "/", "")
        end
      end

      expect(violations).to be_empty,
        "Identity slice should not directly access Portfolio::Slice.\n" \
        "Violations found in:\n  #{violations.join("\n  ")}"
    end

    it "does not directly access Social::Slice" do
      violations = []

      identity_files.each do |file|
        content = File.read(file)
        if content.include?("Social::Slice[")
          violations << file.sub(Monolith::App.root.to_s + "/", "")
        end
      end

      expect(violations).to be_empty,
        "Identity slice should not directly access Social::Slice.\n" \
        "Violations found in:\n  #{violations.join("\n  ")}"
    end
  end
end
