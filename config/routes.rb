Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  get "/login", to: "sessions#new", as: :login
  post "/login", to: "sessions#create"
  post "/logout", to: "sessions#destroy", as: :logout
  get "/signup", to: "registrations#new", as: :signup
  post "/signup", to: "registrations#create"
  get "/auth/google_oauth2/callback", to: "oauth#create"
  get "/auth/failure", to: "oauth#failure"
  get "/admin", to: "admin#index", as: :admin
  post "/capsules/:id/delete", to: "capsule_deletions#create"
  post "/rails/active_storage/direct_uploads", to: "direct_uploads#create"

  get "/draft-invitations/:token", to: "capsule_invitations#show", as: :capsule_invitation
  post "/draft-invitations/:token", to: "capsule_invitations#accept"

  namespace :api do
    post "capsules/:capsule_id/invitations", to: "/capsule_invitations#create"
    get "capsules/:capsule_id/activity", to: "capsule_activity#show"
    put "capsules/:capsule_id/activity", to: "capsule_activity#update"
    resource :session, only: :show
    resources :uploads, only: :create
    resources :capsules, only: %i[index create show update destroy]
  end

  root to: redirect("/index.html")
end
