Then('the sealed stamp shows my customized icon layout') do
  icon = find('#capsule-poster .pb.icon', exact_text: '✦')
  geometry = page.evaluate_script('["left","top","width","height","transform"].map(key => arguments[0].style[key])', icon)
  expect(geometry).to eq(@saved_poster_geometry)
end
