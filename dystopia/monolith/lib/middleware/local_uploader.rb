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
      # Read query_string only so raw PUT bodies are not parsed as form parameters.
      query_params = Rack::Utils.parse_query(request.query_string)
      key = query_params["key"]
      if key.nil? || key.empty?
        return [400, { "content-type" => "text/plain" }, ["Missing key"]]
      end


      if key.include?("..")
        # Keep this uploader development-only because key validation is intentionally minimal.
        return [400, { "content-type" => "text/plain" }, ["Invalid key"]]
      end

      path = File.join("public", "uploads", key)
      dir = File.dirname(path)
      FileUtils.mkdir_p(dir)

      File.open(path, "wb") do |f|
        IO.copy_stream(request.body, f)
      end

      [200, { "content-type" => "text/plain" }, ["Uploaded"]]
    rescue => e
      [500, { "content-type" => "text/plain" }, ["Upload failed: #{e.message}"]]
    end
  end
end
