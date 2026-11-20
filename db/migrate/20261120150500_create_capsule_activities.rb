class CreateCapsuleActivities < ActiveRecord::Migration[7.1]
  def change
    create_table :capsule_activities do |t|
      t.references :capsule, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.jsonb :preview, null: false, default: {}
      t.integer :draft_version, null: false
      t.datetime :updated_at, null: false
      t.index [:capsule_id, :user_id], unique: true
    end
  end
end
