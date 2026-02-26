# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Profile::Publish do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  describe "#call" do
    let(:cast_user_id) { SecureRandom.uuid }
    let(:visibility) { "public" }

    context "when cast exists and already registered" do
      let(:cast) { double(:cast, registered_at: Time.now) }

      it "saves the cast visibility" do
        expect(repo).to receive(:find_by_id).with(cast_user_id).and_return(cast)
        expect(repo).to receive(:save_visibility).with(cast_user_id, visibility)

        use_case.call(cast_user_id: cast_user_id, visibility: visibility)
      end
    end

    context "when cast exists but not registered" do
      let(:cast) { double(:cast, registered_at: nil) }

      it "completes registration and saves visibility" do
        expect(repo).to receive(:find_by_id).with(cast_user_id).and_return(cast)
        expect(repo).to receive(:complete_registration).with(cast_user_id)
        expect(repo).to receive(:save_visibility).with(cast_user_id, visibility)

        use_case.call(cast_user_id: cast_user_id, visibility: visibility)
      end
    end

    context "when cast does not exist" do
      it "does nothing" do
        expect(repo).to receive(:find_by_id).with(cast_user_id).and_return(nil)
        expect(repo).not_to receive(:save_visibility)

        use_case.call(cast_user_id: cast_user_id, visibility: visibility)
      end
    end
  end
end
