# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Images::GetUploadUrl do
  let(:use_case) { described_class.new }

  describe "#call" do
    let(:user_id) { "user-123" }
    let(:filename) { "photo.jpg" }
    let(:content_type) { "image/jpeg" }

    context "with valid input" do
      it "returns success with url and key" do
        allow(Storage).to receive(:upload_url).and_return("https://example.com/upload")

        result = use_case.call(user_id: user_id, filename: filename, content_type: content_type)

        expect(result).to be_success
        expect(result.value![:url]).to eq("https://example.com/upload")
        expect(result.value![:key]).to match(/casts\/#{user_id}\/uploads\/.*\.jpg/)
      end
    end

    context "with empty filename" do
      it "returns failure" do
        result = use_case.call(user_id: user_id, filename: "", content_type: content_type)

        expect(result).to be_failure
        expect(result.failure).to eq(:invalid_input)
      end
    end

    context "with empty content_type" do
      it "returns failure" do
        result = use_case.call(user_id: user_id, filename: filename, content_type: "")

        expect(result).to be_failure
        expect(result.failure).to eq(:invalid_input)
      end
    end
  end
end
