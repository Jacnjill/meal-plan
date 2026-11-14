# Raja & Laurence meal plan

A phone-friendly page for reading the weekly meals. It is plain HTML, CSS, and JavaScript. There is no build step. GitHub Pages serves the files from the repository root.

**Site:** https://jacnjill.github.io/meal-plan/

The file in the repo today is one sample week (9–15 November 2026) so the page has something to show. Replace it with the real plan when you have it. Today and Tomorrow follow the date in London, so they only fill in when that date is in `data/plan.json`. Other dates still appear under Week.

## Update the meals

Edit [`data/plan.json`](data/plan.json). The page reads that file in the browser. Add another object to the `weeks` array for each new week. The Week and Shopping views grow a tab per week on their own.

```json
{
  "currency": "GBP",
  "weeks": [
    {
      "id": "2026-11-16",
      "name": "16–22 November",
      "days": [
        {
          "date": "2026-11-16",
          "weekday": "Monday",
          "meals": {
            "breakfast": {
              "name": "Porridge with banana",
              "ingredients": [{ "item": "Porridge oats", "qty": "80g" }],
              "steps": ["Simmer the oats in milk.", "Slice the banana on top."],
              "portions": { "raja": "A full bowl", "laurence": "A smaller bowl" },
              "kcal": 380
            },
            "lunch": {},
            "dinner": {}
          }
        }
      ],
      "shopping": [
        {
          "aisle": "Grains and tins",
          "estimatedCost": 2.5,
          "items": [{ "item": "Porridge oats", "qty": "1kg" }]
        }
      ]
    }
  ]
}
```

- `date` is `YYYY-MM-DD`. `weekday` must match that date.
- Each day needs `breakfast`, `lunch`, and `dinner`.
- `ingredients` are `{ "item", "qty" }`. `steps` are short lines of text.
- `portions.raja` and `portions.laurence` say how to plate the meal. Keep them as plate, bowl, or slice descriptions.
- `kcal` is an estimate per serving. The page always shows it as an estimate.
- `shopping` is grouped by aisle. `estimatedCost` is a rough aisle total in pounds.
- `id` is used for the week tab and for shopping ticks. Use a new id for each week.
- Shopping ticks live in the phone's browser only. Changing an item's name or quantity starts that line unticked.

Check the file before you commit:

```bash
node scripts/check-plan.js
```

## What the page does

- **Today** and **Tomorrow** use the phone's clock, in Europe/London.
- **Week** has a tab for each week. Open a meal for ingredients and steps.
- **Shopping** has a checkbox per line. Ticks are saved in `localStorage` on that phone.
- Each meal has a note box, and there is a general one at the bottom. **Email this note** opens the phone's mail app. The subject starts with `DIET feedback:` plus the date and the meal. Nothing is stored on a server.

To send notes somewhere else, change `FEEDBACK_EMAIL` at the top of `app.js`. That address is the only personal email in this project.

## Privacy

The repository and the Pages site are public. Anyone with the link can read the plan. Do not put body weights, health conditions, or other email addresses in `data/plan.json` or on the page. Calories on the page are estimates, not measurements.

## Preview on your computer

From the repository root:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 . Opening `index.html` as a file will not load the plan in every browser, because the page fetches `data/plan.json`.

## GitHub Pages

The site is published from the root of `main`. There is nothing to compile.

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) uploads that root to GitHub Pages on every push to `main`.

The first time, a repo admin needs Pages set to GitHub Actions:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

After that, merging to `main` publishes https://jacnjill.github.io/meal-plan/ . The address needs the trailing slash.

You can turn that source on from the API (admin rights required):

```bash
gh api --method POST repos/Jacnjill/meal-plan/pages --input - <<'EOF'
{"build_type":"workflow"}
EOF
```

### Publish from the branch instead

If you would rather not use Actions:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Choose branch `main` and folder `/ (root)`, then save.
4. Delete `.github/workflows/pages.yml` so Actions is not also trying to publish.

`.nojekyll` is already in the root, so Pages will not run Jekyll or hide the `data` folder.

This copy of the repo could not turn Pages on by itself: the token here does not have admin rights on the repository. The steps above are the one-time switch.
