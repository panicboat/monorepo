# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Profile::GetProfile do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }
  let(:user_id) { "user-uuid" }
  let(:cast) { double(:cast) }

  describe "#call" do
    context "when cast exists" do
      it "returns the cast with plans" do
        allow(repo).to receive(:find_by_user_id_with_plans).with(user_id).and_return(cast)

        result = use_case.call(user_id: user_id)
        expect(result).to eq(cast)
      end
    end

    context "when cast does not exist" do
      it "returns nil" do
        allow(repo).to receive(:find_by_user_id_with_plans).with(user_id).and_return(nil)

        result = use_case.call(user_id: user_id)
        expect(result).to eq(nil)
      end
    end
  end
end
