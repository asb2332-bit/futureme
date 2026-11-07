require "uri"

class Capsule < ApplicationRecord
  MAX_MEDIA_SIZE = 2.megabytes

  belongs_to :user, optional: true
  has_many_attached :images
  has_many_attached :audio
  has_many_attached :video
  validates :title, :message, :unlock_at, presence: true
  validate :unlock_at_is_in_the_future, on: :create
  validate :images_are_valid
  validate :audio_is_valid
  validate :video_is_valid
  validate :media_total_is_valid
  validate :media_files_are_valid
  validate :remote_image_urls_use_https

  def unlocked?
    unlock_at <= Time.current
  end

  def locked?
    !unlocked?
  end

  private

  def unlock_at_is_in_the_future
    errors.add(:unlock_at, "must be in the future") if unlock_at.present? && unlock_at <= Time.current
  end

  def images_are_valid
    images.each do |image|
      errors.add(:images, "must be an image") unless image.blob.content_type&.start_with?("image/")
    end
  end

  def audio_is_valid
    audio.each do |file|
      errors.add(:audio, "must be audio") unless file.blob.content_type&.start_with?("audio/")
    end
  end

  def video_is_valid
    video.each do |file|
      errors.add(:video, "must be video") unless file.blob.content_type&.start_with?("video/")
    end
  end

  def media_total_is_valid
    total_size = (images.blobs + audio.blobs + video.blobs).sum(&:byte_size)
    errors.add(:base, "uploaded media must be 2 MB or smaller in total") if total_size > MAX_MEDIA_SIZE
  end

  def media_files_are_valid
    (images.blobs + audio.blobs + video.blobs).each do |file|
      errors.add(:base, "each uploaded file must be 2 MB or smaller") if file.byte_size > MAX_MEDIA_SIZE
    end
  end

  def remote_image_urls_use_https
    Array(design["remote_image_urls"]).each do |image_url|
      uri = URI.parse(image_url)
      errors.add(:design, "remote image URLs must use HTTPS") unless uri.is_a?(URI::HTTPS) && uri.host.present?
    rescue URI::InvalidURIError, TypeError
      errors.add(:design, "remote image URLs must use HTTPS")
    end
  end
end
