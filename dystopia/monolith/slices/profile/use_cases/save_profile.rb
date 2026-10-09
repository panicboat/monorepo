# frozen_string_literal: true

require "errors/validation_error"

module Profile
  module UseCases
    class SaveProfile
      include Deps["repositories.profile_repository", "repositories.cast_repository"]

      DISPLAY_NAME_MAX = 50
      BIO_MAX = 1000
      USERNAME_FORMAT = /\A[A-Za-z0-9_]{3,30}\z/
      ROLE_CAST = 2

      def call(profile_id:, display_name:, username: nil, bio: nil, website: nil,
               sns_links: {}, prefecture: nil, is_private: false, age: nil,
               body_stats: {}, industry: nil)
        return nil unless profile_repository.find_by_id(profile_id)

        validate_display_name!(display_name)
        validate_bio!(bio)
        validate_username!(username, profile_id) unless username.nil?

        attrs = {
          display_name: display_name,
          bio: bio,
          website: website,
          prefecture: prefecture,
          is_private: is_private ? true : false
        }
        attrs[:username] = username unless username.nil?

        profile_repository.update_profile(profile_id, attrs)

        if profile_repository.role_of(profile_id) == ROLE_CAST
          cast_repository.upsert(
            profile_id: profile_id,
            attrs: {
              sns_links: Sequel.pg_jsonb(sns_links || {}),
              age: age,
              body_stats: Sequel.pg_jsonb(body_stats || {}),
              industry: industry
            }
          )
        end

        profile_repository.find_by_id(profile_id)
      end

      private

      def validate_display_name!(value)
        if value.nil? || value.strip.empty?
          raise Errors::ValidationError, "表示名は必須です"
        end
        if value.length > DISPLAY_NAME_MAX
          raise Errors::ValidationError, "表示名は#{DISPLAY_NAME_MAX}文字以内で入力してください"
        end
      end

      def validate_bio!(value)
        return if value.nil?

        if value.length > BIO_MAX
          raise Errors::ValidationError, "自己紹介は#{BIO_MAX}文字以内で入力してください"
        end
      end

      def validate_username!(value, profile_id)
        unless value.match?(USERNAME_FORMAT)
          raise Errors::ValidationError, "ユーザー名は半角英数字とアンダースコア3〜30文字です"
        end
        unless profile_repository.username_available?(value, exclude_profile_id: profile_id)
          raise Errors::ValidationError, "このユーザー名は使用できません"
        end
      end
    end
  end
end
