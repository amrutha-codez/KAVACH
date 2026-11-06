# Charts Page (Student 3)

Charts page for the women's safety app: time-of-day cards, 6-month trend, score bars,
compare table, Safest / Least safe lists, and an area dropdown. Works on laptop and phone.

## Files
```
charts.html          the page
css/theme.css        SHARED colors + card style (use on every page)
css/charts.css       Charts page layout only
js/common.js         SHARED rules: score bands + time-of-day slots
js/charts.js         Charts page logic
data/locations.json  area scores (from the team data file)
```

## Rules (kept in js/common.js and css/theme.css)
- Score colors: 65-100 Safe, 45-64 Medium, 0-44 Risky
- Time of day: Morning 5 AM-12 PM, Afternoon 12-6 PM, Night 6 PM-5 AM

## Run it
Open through a web server (the page loads `data/locations.json`):
```
python -m http.server
```
then visit http://localhost:8000/charts.html

## GitHub Pages
Upload all files keeping the folder structure, then Settings > Pages > Deploy from branch.

## Notes
- Nav links assume index.html, navigate.html, community.html, profile.html. Edit in charts.html if different.
- Compare table shows the selected area plus its 2 nearest areas.
- Areas with missing trend months (e.g. CMRIT, AECS Layout) show only the months that have data.
