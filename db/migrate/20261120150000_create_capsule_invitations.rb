class CreateCapsuleInvitations < ActiveRecord::Migration[7.1]
  def change
    create_table :capsule_invitations do |t|
      t.references :capsule, null: false, foreign_key: { on_delete: :cascade }
      t.string :email, null: false
      t.datetime :accepted_at
      t.timestamps
    end
  end
end
