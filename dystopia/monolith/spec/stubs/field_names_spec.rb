# frozen_string_literal: true

require "spec_helper"

RSpec.describe "proto field names" do
  ACCOUNT_SCOPED_PACKAGES = %w[identity.v1 billing.v1].freeze

  let(:stub_files) do
    Dir[File.expand_path("../../stubs/**/*_pb.rb", __dir__)].reject { |path| path.end_with?("_services_pb.rb") }
  end

  let(:message_names) do
    stub_files.each { |path| require path }
    stub_files.flat_map { |path| File.read(path).scan(/lookup\("([\w.]+)"\)\.msgclass/).flatten }
  end

  it "reads the messages of every package" do
    packages = message_names.map { |name| name.split(".").first(2).join(".") }.uniq

    expect(packages).to include("profile.v1", "post.v1", "social.v1", "messaging.v1", "karte.v1", "review.v1")
  end

  it "names no field after an account id outside the identity and billing packages" do
    pool = Google::Protobuf::DescriptorPool.generated_pool
    exposed = message_names.reject { |name| ACCOUNT_SCOPED_PACKAGES.any? { |package| name.start_with?("#{package}.") } }

    offenders = exposed.flat_map do |name|
      pool.lookup(name).map(&:name).grep(/account_id/).map { |field| "#{name}.#{field}" }
    end

    expect(offenders).to eq([])
  end
end
