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

      it "updates physical attributes" do
        expect(repo).to receive(:find_by_user_id).with(user_id).and_return(cast)
        expect(repo).to receive(:update).with(
          cast.id,
          hash_including(
            age: 25,
            height: 165,
            blood_type: "A"
          )
        )

        use_case.call(
          user_id: user_id,
          name: "New",
          bio: "Bio",
          age: 25,
          height: 165,
          blood_type: "A"
        )
      end

      it "updates three_sizes as jsonb" do
        three_sizes = { "bust" => 88, "waist" => 60, "hip" => 90, "cup" => "D" }
        expect(repo).to receive(:find_by_user_id).with(user_id).and_return(cast)
        expect(repo).to receive(:update) do |id, attrs|
          expect(id).to eq(cast.id)
          expect(attrs[:three_sizes]).to be_a(Sequel::Postgres::JSONBHash)
        end

        use_case.call(user_id: user_id, name: "New", bio: "Bio", three_sizes: three_sizes)
      end

      it "updates tags as jsonb array" do
        tags = %w[model bilingual]
        expect(repo).to receive(:find_by_user_id).with(user_id).and_return(cast)
        expect(repo).to receive(:update) do |id, attrs|
          expect(id).to eq(cast.id)
          expect(attrs[:tags]).to be_a(Sequel::Postgres::JSONBArray)
        end

        use_case.call(user_id: user_id, name: "New", bio: "Bio", tags: tags)
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

      it "creates the cast with physical attributes" do
        expect(repo).to receive(:find_by_user_id).with(user_id).and_return(nil)
        expect(repo).to receive(:create).with(hash_including(
          user_id: user_id,
          name: "New",
          bio: "Bio",
          age: 22,
          height: 170,
          blood_type: "O"
        ))

        use_case.call(
          user_id: user_id,
          name: "New",
          bio: "Bio",
          age: 22,
          height: 170,
          blood_type: "O"
        )
      end
    end
  end
end
