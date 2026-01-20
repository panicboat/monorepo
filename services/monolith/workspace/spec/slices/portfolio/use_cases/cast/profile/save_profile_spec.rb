# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Profile::SaveProfile do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  describe "#call" do
    let(:user_id) { SecureRandom.uuid }
    let(:cast) { double(id: 1, name: "Old", bio: "Bio") }

    context "when cast exists" do
      it "updates the cast" do
        expect(repo).to receive(:find_by_user_id).with(user_id).and_return(cast)
        expect(repo).to receive(:update).with(cast.id, hash_including(name: "New", bio: "New Bio"))

        use_case.call(user_id: user_id, name: "New", bio: "New Bio")
      end
    end

    context "when cast does not exist" do
      it "creates the cast" do
        expect(repo).to receive(:find_by_user_id).with(user_id).and_return(nil)
        expect(repo).to receive(:create).with(hash_including(
          user_id: user_id,
          name: "New",
          bio: "New Bio",
          visibility: "unregistered"
        ))

        use_case.call(user_id: user_id, name: "New", bio: "New Bio")
      end
    end
  end
end
