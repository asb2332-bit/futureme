require "rails_helper"

RSpec.describe "Capsule collaboration", type: :request do
  let(:owner) { User.create!(email_address: "owner@example.com", password: "secure-password") }
  let(:editor) { User.create!(email_address: "editor@example.com", password: "secure-password") }
  let(:draft) { owner.capsules.create!(draft: true, title: "Shared draft", message: "") }

  def login(user)
    post login_path, params: { email_address: user.email_address, password: "secure-password" }
  end

  it "emails a draft link and restores the invitation after login" do
    login(owner)
    expect {
      post "/api/capsules/#{draft.id}/invitations", params: { email: editor.email_address }, as: :json
    }.to change(ActionMailer::Base.deliveries, :size).by(1)
    expect(response).to have_http_status(:created)
    mail = ActionMailer::Base.deliveries.last
    expect(mail.to).to eq([editor.email_address])
    path = URI.parse(mail.body.decoded.lines.map(&:strip).find { |line| line.start_with?("http") }).path

    get path
    expect(response).to have_http_status(:forbidden)
    post logout_path
    get path
    expect(response).to redirect_to(login_path)
    login(editor)
    expect(response).to redirect_to(path)
    post path
    expect(response).to redirect_to("/create.html?id=#{draft.id}")
    expect(draft.editors).to include(editor)
    get api_capsule_path(draft), params: { editing: true }
    expect(response.parsed_body).to include("title" => "Shared draft", "owner" => false)
  end

  it "shares live previews only with accounts that can edit the same draft" do
    path = "/api/capsules/#{draft.id}/activity"
    login(editor)
    get path
    expect(response).to have_http_status(:not_found)

    draft.editors << editor
    login(owner)
    put path, params: { version: draft.reload.lock_version,
      preview: { kind: "typing", field: "Message", text: "Hello" } }, as: :json
    expect(response).to have_http_status(:no_content)

    login(editor)
    get path
    expect(response.parsed_body.fetch("previews")).to eq([
      { "email" => owner.email_address, "preview" => { "kind" => "typing", "field" => "Message", "text" => "Hello" } }
    ])

    put path, params: { version: draft.lock_version,
      preview: { kind: "dragging", label: "title", x: 20, y: 10, width: 50, height: 15 } }, as: :json
    expect(response).to have_http_status(:no_content)

    login(owner)
    get path
    expect(response.parsed_body.fetch("previews").first).to include(
      "email" => editor.email_address,
      "preview" => include("kind" => "dragging", "x" => 20)
    )
  end
end
