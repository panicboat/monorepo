# frozen_string_literal: true

require "spec_helper"
require "rack"
require "middleware/local_uploader"

RSpec.describe Middleware::LocalUploader do
  let(:app) { ->(env) { [200, { "content-type" => "text/plain" }, ["OK"]] } }
  let(:middleware) { described_class.new(app) }

  def mock_request(method, path, body: nil)
    env = Rack::MockRequest.env_for(
      path,
      method: method,
      input: body ? StringIO.new(body) : nil
    )
    middleware.call(env)
  end

  describe "non-upload requests" do
    it "passes through to the app for GET requests" do
      status, headers, body = mock_request("GET", "/some/path")

      expect(status).to eq(200)
      expect(body).to eq(["OK"])
    end

    it "passes through for non-upload paths" do
      status, headers, body = mock_request("POST", "/other/path")

      expect(status).to eq(200)
      expect(body).to eq(["OK"])
    end
  end

  describe "POST /storage/upload" do
    let(:upload_dir) { "public/uploads/test" }
    let(:test_key) { "test/upload_test.txt" }
    let(:test_content) { "test file content" }

    after do
      FileUtils.rm_rf(upload_dir)
    end

    it "uploads file and returns success" do
      status, headers, body = mock_request(
        "POST",
        "/storage/upload?key=#{test_key}",
        body: test_content
      )

      expect(status).to eq(200)
      expect(body).to eq(["Uploaded"])
      expect(File.exist?("public/uploads/#{test_key}")).to be(true)
      expect(File.read("public/uploads/#{test_key}")).to eq(test_content)
    end

    it "returns 400 for missing key" do
      status, headers, body = mock_request("POST", "/storage/upload")

      expect(status).to eq(400)
      expect(body).to eq(["Missing key"])
    end

    it "returns 400 for empty key" do
      status, headers, body = mock_request("POST", "/storage/upload?key=")

      expect(status).to eq(400)
      expect(body).to eq(["Missing key"])
    end

    it "returns 400 for directory traversal attempt" do
      status, headers, body = mock_request("POST", "/storage/upload?key=../../../etc/passwd")

      expect(status).to eq(400)
      expect(body).to eq(["Invalid key"])
    end
  end

  describe "PUT /storage/upload" do
    let(:upload_dir) { "public/uploads/test" }
    let(:test_key) { "test/put_upload_test.txt" }
    let(:test_content) { "put file content" }

    after do
      FileUtils.rm_rf(upload_dir)
    end

    it "uploads file via PUT and returns success" do
      status, headers, body = mock_request(
        "PUT",
        "/storage/upload?key=#{test_key}",
        body: test_content
      )

      expect(status).to eq(200)
      expect(body).to eq(["Uploaded"])
      expect(File.exist?("public/uploads/#{test_key}")).to be(true)
      expect(File.read("public/uploads/#{test_key}")).to eq(test_content)
    end
  end

  describe "creates nested directories" do
    let(:nested_key) { "deeply/nested/path/file.txt" }
    let(:test_content) { "nested content" }

    after do
      FileUtils.rm_rf("public/uploads/deeply")
    end

    it "creates parent directories if they don't exist" do
      status, headers, body = mock_request(
        "POST",
        "/storage/upload?key=#{nested_key}",
        body: test_content
      )

      expect(status).to eq(200)
      expect(File.exist?("public/uploads/#{nested_key}")).to be(true)
    end
  end
end
