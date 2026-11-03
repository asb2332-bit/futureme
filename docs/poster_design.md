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
