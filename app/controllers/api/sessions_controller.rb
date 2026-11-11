class Api::SessionsController < ApplicationController
  def show
    response.headers["Cache-Control"] = "no-store"
    token_options = params[:form_action].present? ? { form_options: { action: params[:form_action], method: :post } } : {}
    render json: { user: current_user&.as_json(only: %i[email_address role]), csrf_token: form_authenticity_token(**token_options),
                   google_drive: { session_id: (current_user && (session[:drive_cache_id] ||= SecureRandom.uuid)), client_id: ENV["GOOGLE_CLIENT_ID"], picker_key: ENV["GOOGLE_PICKER_API_KEY"],
                                   project_number: ENV["GOOGLE_CLOUD_PROJECT_NUMBER"] } }
  end
end
