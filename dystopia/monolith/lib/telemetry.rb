# frozen_string_literal: true

require "opentelemetry-sdk"
require "opentelemetry-exporter-otlp"
require "opentelemetry-instrumentation-all"

module Telemetry
  # endpoint が渡されない環境 (= local dev / spec) で SDK を起動すると、exporter が
  # default の localhost:4318 へ送り続けて失敗ログを吐くため、endpoint の有無を
  # 計装の on/off として扱う。bin/grpc が HANAMI_ENV を production 固定にするので
  # Hanami の env では判定できない。
  def self.configure
    return false if ENV["OTEL_EXPORTER_OTLP_ENDPOINT"].to_s.empty?

    OpenTelemetry::SDK.configure do |c|
      # ActiveSupport は gruf の推移依存として定数だけ存在し、 `ActiveSupport.version`
      # を持たない状態で load されるため compatible? が例外を投げ、 起動のたびに
      # OpenTelemetry error が 1 行出る。 enabled? は compatible? より先に評価される
      # ので config で落とす。 Hanami は ActiveSupport::Notifications を使わないため
      # 失うものはない。
      c.use_all("OpenTelemetry::Instrumentation::ActiveSupport" => { enabled: false })
    end
    true
  end
end
