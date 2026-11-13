require "uri"

class Capsule < ApplicationRecord
  MAX_MEDIA_SIZE = 2.megabytes
  MEDIA_BLOCK_TYPES = %w[image audio video].freeze

  belongs_to :user, optional: true
  has_many_attached :media
  has_many_attached :images
  has_many_attached :audio
  has_many_attached :video

  validates :title, :message, :unlock_at, presence: true
  validate :unlock_at_is_in_the_future, on: :create
  validate :media_blocks_reference_valid_uploads
  validate :images_are_valid
  validate :audio_is_valid
  validate :video_is_valid
  validate :media_total_is_valid
  validate :media_files_are_valid
  validate :remote_image_urls_use_https

  before_save :attach_media_blobs

  def unlocked?
    unlock_at <= Time.current
  end

  def locked?
    !unlocked?
  end

  # Reaching the unlock time only makes a capsule ready; it opens when the owner breaks the seal.
  def opened?
    unlocked? && opened_at.present?
  end

  def open!
    return false if locked?

    update!(opened_at: Time.current) if opened_at.nil?
    true
  end

  def sealed_blocks
    blocks = design.is_a?(Hash) ? design["sealed_blocks"] : nil
    blocks.is_a?(Array) ? blocks.select { |block| block.is_a?(Hash) } : []
  end

  def media_blocks
    sealed_blocks.select { |block| MEDIA_BLOCK_TYPES.include?(block["type"]) }
  end

  def contents
    counts = {
      notes: sealed_blocks.count { |block| !MEDIA_BLOCK_TYPES.include?(block["type"]) },
      photos: media_blocks.count { |block| block["type"] == "image" } + images.count,
      audio: media_blocks.count { |block| block["type"] == "audio" } + audio.count
    }
    videos_count = media_blocks.count { |block| block["type"] == "video" } + video.count
    counts[:videos] = videos_count if videos_count.positive?
    counts
  end

  # Returns sealed blocks with URLs added to signed-id media blocks.
  def sealed_blocks_with_media_urls
    blobs_by_id = media.blobs.index_by(&:id)

    sealed_blocks.map do |block|
      next block unless MEDIA_BLOCK_TYPES.include?(block["type"])

      blob = ActiveStorage::Blob.find_signed(block["media_id"].to_s)
      attached_blob = blobs_by_id[blob&.id]
      attached_blob ? block.merge("url" => yield(attached_blob)) : block
    end
  end

  private

  def unlock_at_is_in_the_future
    errors.add(:unlock_at, "must be in the future") if unlock_at.present? && unlock_at <= Time.current
  end

  def media_blocks_reference_valid_uploads
    @media_blobs = []

    media_blocks.each do |block|
      blob = ActiveStorage::Blob.find_signed(block["media_id"]) if block["media_id"].is_a?(String)
      if blob.nil? || sealed_blob_error(blob, block["type"])
        errors.add(:media, "is invalid")
      else
        @media_blobs << blob
      end
    end
  end

  def sealed_blob_error(blob, expected_kind)
    actual_kind = MediaUpload.kind_for(blob.content_type) || ("video" if blob.content_type.to_s.start_with?("video/"))
    return MediaUpload::TYPE_NOT_SUPPORTED unless actual_kind == expected_kind
    return "File must be 2 MB or smaller" if blob.byte_size > MAX_MEDIA_SIZE

    nil
  end

  def attach_media_blobs
    media.attach(@media_blobs.uniq) if @media_blobs.present?
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
    errors.add(:base, "uploaded media must be 2 MB or smaller in total") if all_media_blobs.sum(&:byte_size) > MAX_MEDIA_SIZE
  end

  def media_files_are_valid
    all_media_blobs.each do |file|
      errors.add(:base, "each uploaded file must be 2 MB or smaller") if file.byte_size > MAX_MEDIA_SIZE
    end
  end

  def all_media_blobs
    (media.blobs.to_a + images.blobs.to_a + audio.blobs.to_a + video.blobs.to_a + Array(@media_blobs))
      .uniq { |blob| blob.id || blob.object_id }
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
