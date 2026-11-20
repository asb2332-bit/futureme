class Api::CapsuleActivityController < ApplicationController
  before_action :require_login
  before_action :load_draft

  def show
    response.headers["Cache-Control"] = "no-store"
    editor_ids = @capsule.capsule_editors.pluck(:user_id) + [@capsule.user_id]
    activity = CapsuleActivity.where(capsule: @capsule, user_id: editor_ids, draft_version: @capsule.lock_version)
      .where("updated_at > ?", 6.seconds.ago).where.not(user_id: current_user.id).includes(:user)
    render json: { version: @capsule.lock_version, previews: activity.map { |row| { email: row.user.email_address, preview: row.preview } } }
  end

  def update
    if params[:version].to_s != @capsule.lock_version.to_s
      return head :conflict
    end
    preview = safe_preview
    return head :unprocessable_entity unless preview

    CapsuleActivity.upsert({ capsule_id: @capsule.id, user_id: current_user.id,
      draft_version: @capsule.lock_version, preview: preview, updated_at: Time.current }, unique_by: %i[capsule_id user_id])
    head :no_content
  end

  private

  def load_draft
    @capsule = Capsule.find_by(id: params[:capsule_id], draft: true)
    unless @capsule && (@capsule.user_id == current_user.id || @capsule.capsule_editors.exists?(user: current_user))
      head :not_found
    end
  end

  def safe_preview
    changes = params[:preview]
    return unless changes.is_a?(ActionController::Parameters)
    case changes[:kind]
    when "typing"
      { kind: "typing", field: changes[:field].to_s.first(40), text: changes[:text].to_s.first(500) }
    when "dragging"
      bounds = %i[x y width height].to_h { |key| [key, Float(changes[key], exception: false)] }
      return unless bounds.values.all? { |value| value && value.between?(0, 100) }
      bounds.merge(kind: "dragging", label: changes[:label].to_s.first(60))
    end
  end
end
