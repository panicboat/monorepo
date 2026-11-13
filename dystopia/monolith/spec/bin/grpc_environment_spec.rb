# frozen_string_literal: true

require "spec_helper"
require "open3"
require "rbconfig"

RSpec.describe "bin/grpc process environment" do
  let(:root) { File.expand_path("../..", __dir__) }
  let(:preamble) { File.read(File.join(root, "bin/grpc")).split(/^require /).first }

  def gruf_development?(inherited)
    script = "#{preamble}\nrequire 'bundler/setup'\nrequire 'gruf'\nprint Gruf.development?"
    # Bundler can warn on stderr about constants the bundled RubyGems already defines, so only stdout carries the answer.
    output, errors, status = Open3.capture3(inherited, RbConfig.ruby, "-e", script, chdir: root)
    raise "the probe process failed: #{errors}" unless status.success?

    output
  end

  it "keeps gruf out of development, where it takes a reload lock on every request" do
    expect(gruf_development?("RACK_ENV" => nil, "RAILS_ENV" => nil)).to eq("false")
  end

  it "does so even when the shell that starts it says development" do
    expect(gruf_development?("RACK_ENV" => "development", "RAILS_ENV" => "development")).to eq("false")
  end
end
