# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::PurgeProfile do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:messaging_repository) }

  it "deletes read_states first, then NULLs out sender_profile_id and thread participants" do
    expect(repo).to receive(:delete_read_states_by_profile).with("cast-1").ordered
    expect(repo).to receive(:null_out_sender).with("cast-1").ordered
    expect(repo).to receive(:null_out_thread_participants).with("cast-1").ordered
    use_case.call(profile_id: "cast-1")
  end
end
