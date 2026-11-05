# Poster design JSON

`capsules.design` stores visual data only. The title and message remain in their existing capsule columns.

```json
{
  "theme": {
    "background_color": "#E3E7DF",
    "accent_color": "#202923",
    "font": "sans",
    "icon": "⏳"
  },
  "title_block": {
    "x": 8,
    "y": 8,
    "width": 84,
    "height": 16,
    "rotation": 0
  },
  "message_block": {
    "x": 8,
    "y": 32,
    "width": 84,
    "height": 40,
    "rotation": 0
  },
  "icon_block": {
    "x": 78,
    "y": 8,
    "width": 12,
    "height": 12,
    "rotation": 0
  },
  "sealed_blocks": [
    {
      "id": "note-1",
      "text": "Additional private text",
      "x": 10,
      "y": 76,
      "width": 60,
      "height": 12,
      "rotation": -4
    }
  ]
}
```

`x`, `y`, `width`, and `height` are percentages of the responsive poster canvas. `rotation` is degrees. `sealed_blocks` and the capsule message are returned only after the capsule unlocks.

Every section is optional, so an empty design or a partial layout remains valid. When present, `theme`, `title_block`, `message_block`, and `icon_block` must be objects, and `sealed_blocks` must be an array of objects.

Colors use six-digit hexadecimal values. The supported fonts are `sans`, `serif`, `mono`, and `display`; the icon is a string. Coordinates must be finite numbers from 0 through 100, sizes must be greater than 0 and at most 100, and rotation must be a finite number. Additional notes may contain a string `id`, a string `text`, and the same layout fields; supplied IDs must be nonempty and unique.

Unknown fields and invalid values are rejected before a capsule is saved. A malformed request returns HTTP 400 with a JSON `errors` object, while an invalid design returns HTTP 422 with messages under `errors.design`.

API responses include only recognized, valid visual fields, even for older records that predate validation. Sealed notes are included only in an unlocked capsule's detail response, and malformed legacy notes are skipped without changing the stored record.
