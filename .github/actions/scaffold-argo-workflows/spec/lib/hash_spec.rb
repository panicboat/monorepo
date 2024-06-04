require 'rspec'
require_relative '../../src/lib/hash'

describe Hash do
  describe '.deep_transform_keys!' do
    it 'transforms all keys of the hash using the provided block' do
      hash = { 'a' => 1, 'b' => { 'c' => 2, 'd' => { 'e' => 3 } } }
      Hash.deep_transform_keys!(hash) { |key| key.upcase }
      expect(hash).to eq({ 'A' => 1, 'B' => { 'C' => 2, 'D' => { 'E' => 3 } } })
    end
  end

  describe '.deep_transform_keys' do
    it 'transforms all keys of the hash using the provided block' do
      hash = { 'a' => 1, 'b' => { 'c' => 2, 'd' => { 'e' => 3 } } }
      hash = Hash.deep_transform_keys(hash) { |key| key.upcase }
      expect(hash).to eq({ 'A' => 1, 'B' => { 'C' => 2, 'D' => { 'E' => 3 } } })
    end
  end

  describe '.deep_symbolize_keys' do
    it 'converts all string keys to symbols' do
      hash = { 'a' => 1, 'b' => { 'c' => 2, 'd' => { 'e' => 3 } } }
      result = Hash.deep_symbolize_keys(hash)
      expect(result).to eq({ :a => 1, :b => { :c => 2, :d => { :e => 3 } } })
    end
  end
end
