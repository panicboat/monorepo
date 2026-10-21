# frozen_string_literal: true

require "spec_helper"
require "profile/v1/service_pb"

RSpec.describe Profile::Presenters::ProfileSummaryPresenter do
  it "copies every field into the proto" do
    summary = Profile::UseCases::SummarizeProfiles::Summary.new(
      profile_id: "p-1", username: "rin", display_name: "りん", avatar_url: "https://cdn.example/a.png", is_private: true, role: 2, industry: "fuzoku"
    )

    proto = described_class.to_proto(summary)

    expect([proto.profile_id, proto.username, proto.display_name, proto.avatar_url, proto.is_private, proto.role, proto.industry])
      .to eq(["p-1", "rin", "りん", "https://cdn.example/a.png", true, 2, "fuzoku"])
  end

  it "returns nil for no summary" do
    expect(described_class.to_proto(nil)).to be_nil
  end
end
