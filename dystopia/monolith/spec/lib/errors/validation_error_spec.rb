# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe Errors::ValidationError do
  it "stores errors" do
    errors = { name: ["is required"] }
    error = described_class.new(errors)
    expect(error.errors).to eq(errors)
  end

  context "with hash-like errors (dry-validation)" do
    it "formats field error with Japanese field name" do
      errors = double(to_h: { phone_number: ["は有効な電話番号形式で入力してください"] })
      error = described_class.new(errors)
      expect(error.message).to eq("電話番号は有効な電話番号形式で入力してください")
    end

    it "formats nested field error" do
      errors = double(to_h: { plans: { 0 => { name: ["は空白のみでは登録できません"] } } })
      error = described_class.new(errors)
      expect(error.message).to eq("名前は空白のみでは登録できません")
    end

    it "formats base error without field name" do
      errors = double(to_h: { base: ["本文またはメディアが必要です"] })
      error = described_class.new(errors)
      expect(error.message).to eq("本文またはメディアが必要です")
    end

    it "falls back to to_s for unknown field" do
      errors = double(to_h: { unknown_field: ["はエラーです"] })
      error = described_class.new(errors)
      expect(error.message).to eq("unknown_fieldはエラーです")
    end
  end

  context "with string errors (manual validation)" do
    it "uses string as-is" do
      error = described_class.new("名前は必須です")
      expect(error.message).to eq("名前は必須です")
    end
  end
end
