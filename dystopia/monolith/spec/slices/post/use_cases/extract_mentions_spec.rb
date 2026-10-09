# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::ExtractMentions", type: :database do
  let(:use_case) { Hanami.app.slices[:post]["use_cases.extract_mentions"] }
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  def create_profile(username:)
    create_account_with_profile(display_name: username, username: username)
  end

  it "returns an empty array for content with no mentions" do
    expect(use_case.call(content: "hello world")).to eq([])
  end

  it "returns an empty array for empty content" do
    expect(use_case.call(content: "")).to eq([])
  end

  it "resolves a single mention to its account_id, position, and length" do
    id = create_profile(username: "alice_1")

    result = use_case.call(content: "hi @alice_1!")

    expect(result).to eq([{ account_id: id, position: 3, length: 8 }])
  end

  it "resolves multiple mentions at their respective positions" do
    id_a = create_profile(username: "alice_1")
    id_b = create_profile(username: "bob_2")

    result = use_case.call(content: "@alice_1 and @bob_2")

    expect(result).to eq([
      { account_id: id_a, position: 0, length: 8 },
      { account_id: id_b, position: 13, length: 6 }
    ])
  end

  it "ignores candidates that do not resolve to an existing account" do
    result = use_case.call(content: "hi @nobody_here_xyz")

    expect(result).to eq([])
  end

  it "resolves usernames case-insensitively" do
    id = create_profile(username: "alice_1")

    result = use_case.call(content: "@ALICE_1")

    expect(result).to eq([{ account_id: id, position: 0, length: 8 }])
  end

  it "does not match a candidate immediately followed by another word character" do
    create_profile(username: "alice")

    result = use_case.call(content: "@alice_and_more")

    expect(result).to eq([])
  end

  it "keeps repeated mentions of the same account as separate entries" do
    id = create_profile(username: "alice_1")

    result = use_case.call(content: "@alice_1 @alice_1")

    expect(result).to eq([
      { account_id: id, position: 0, length: 8 },
      { account_id: id, position: 9, length: 8 }
    ])
  end

  it "looks up each unique username only once" do
    id = create_profile(username: "alice_1")
    extractor = Post::UseCases::ExtractMentions.new(profile_repo: profile_repo)

    expect(profile_repo).to receive(:find_by_username).with("alice_1").once.and_call_original

    result = extractor.call(content: "@alice_1 @alice_1 @alice_1")

    expect(result.map { |mention| mention[:account_id] }).to eq([id, id, id])
  end

  it "does not match a username embedded in an email address" do
    create_profile(username: "alice_1")

    expect(use_case.call(content: "contact me@alice_1.com")).to eq([])
  end
end
