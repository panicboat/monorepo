module Middleware
  class LocalUploader
    def initialize(app)
      @app = app
    end

    def call(env)
      require "rack"
      request = Rack::Request.new(env)

      if request.path == "/storage/upload" && (request.post? || request.put?)
        handle_upload(request)
      else
        @app.call(env)
      end
    end

    private

    def handle_upload(request)
      # Use query_string only to avoid consuming POST body when parsing params
      query_params = Rack::Utils.parse_query(request.query_string)
      key = query_params["key"]
      if key.nil? || key.empty?
        return [400, { "content-type" => "text/plain" }, ["Missing key"]]
      end

      # In a PUT request for Presigned URL simulation, the body is the file content.
      # However, our client uses `fetch(url, { method: 'PUT', body: file })`.
      # Rack Request might try to parse params if it's form data, but here it's raw.
      # We just read the input stream.

      # Security Note: Thorough input validation for 'key' is crucial in production
      # to prevent directory traversal. Since this is DEV only, basic check is fine.
      if key.include?("..")
        return [400, { "content-type" => "text/plain" }, ["Invalid key"]]
      end

      path = File.join("public", "uploads", key)
      dir = File.dirname(path)
      FileUtils.mkdir_p(dir)

      # Write body to file
      File.open(path, "wb") do |f|
        IO.copy_stream(request.body, f)
      end

      [200, { "content-type" => "text/plain" }, ["Uploaded"]]
    rescue => e
      [500, { "content-type" => "text/plain" }, ["Upload failed: #{e.message}"]]
    end
  end
end
