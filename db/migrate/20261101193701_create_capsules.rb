class CreateCapsules < ActiveRecord::Migration[7.1]
  def change
    create_table :capsules do |t|
      t.string :title, null: false
      t.text :message, null: false
      t.datetime :unlock_at, null: false

      t.timestamps
    end
  end
end
