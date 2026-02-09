# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::Contracts::SavePostContract do
  let(:contract) { described_class.new }

  describe "valid input" do
    it "succeeds with content only" do
      result = contract.call(cast_id: "abc-123", content: "Hello world")
      expect(result).to be_success
    end

    it "succeeds with media only" do
      result = contract.call(
        cast_id: "abc-123",
        media: [{ media_type: "image", url: "http://example.com/img.jpg" }]
      )
      expect(result).to be_success
    end

    it "succeeds with content and media" do
      result = contract.call(
        cast_id: "abc-123",
        content: "Hello",
        media: [{ media_type: "image", url: "http://example.com/img.jpg" }]
      )
      expect(result).to be_success
    end

    it "succeeds with optional id" do
      result = contract.call(cast_id: "abc-123", id: "post-1", content: "Hello world")
      expect(result).to be_success
    end

    it "succeeds with visibility flag" do
      result = contract.call(cast_id: "abc-123", content: "Hello world", visibility: "private")
      expect(result).to be_success
    end

    it "succeeds with id and no content or media (visibility update)" do
      result = contract.call(cast_id: "abc-123", id: "post-1", visibility: "private")
      expect(result).to be_success
    end

    it "succeeds with video media and thumbnail" do
      result = contract.call(
        cast_id: "abc-123",
        media: [{ media_type: "video", url: "http://example.com/vid.mp4", thumbnail_url: "http://example.com/thumb.jpg" }]
      )
      expect(result).to be_success
    end
  end

  describe "invalid input" do
    it "fails when cast_id is missing" do
      result = contract.call(content: "Hello")
      expect(result).to be_failure
      expect(result.errors[:cast_id]).not_to be_empty
    end

    it "fails when both content and media are missing" do
      result = contract.call(cast_id: "abc-123")
      expect(result).to be_failure
    end

    it "fails when content is empty and no media" do
      result = contract.call(cast_id: "abc-123", content: "")
      expect(result).to be_failure
    end

    it "fails when content exceeds max length" do
      long_content = "a" * 5001
      result = contract.call(cast_id: "abc-123", content: long_content)
      expect(result).to be_failure
      expect(result.errors[:content]).not_to be_empty
    end

    it "fails with invalid media_type" do
      result = contract.call(
        cast_id: "abc-123",
        content: "Hello",
        media: [{ media_type: "audio", url: "http://example.com/audio.mp3" }]
      )
      expect(result).to be_failure
    end

    it "fails when media url is missing" do
      result = contract.call(
        cast_id: "abc-123",
        content: "Hello",
        media: [{ media_type: "image" }]
      )
      expect(result).to be_failure
    end
  end

  describe "boundary values" do
    it "succeeds with content at max length" do
      content = "a" * 5000
      result = contract.call(cast_id: "abc-123", content: content)
      expect(result).to be_success
    end
  end
end
