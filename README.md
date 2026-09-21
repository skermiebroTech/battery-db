# Laptop Battery Finder!

A static, searchable database of laptop models and the OEM battery each one takes.
It runs on GitHub Pages with no build step and no server.

## Use the site

Type a laptop model, a brand, or a battery code. Results update as you type.
Click a part number to copy it. Use the **Batteries** view to see every laptop that shares one battery.
The URL hash keeps the search, so you can share a link such as `#q=latitude%207430`.

## Update the data

1. Edit `data/batteries.csv`. One row per laptop model. Columns:

   | Column | Content |
   |---|---|
   | `brand` | Manufacturer, for example `Dell` |
   | `model` | Full product name |
   | `alias` | Other names for the same model, separated by ` \| ` |
   | `battery_type` | Battery family code(s), separated by `; ` |
   | `part_numbers` | OEM part number(s), separated by `; ` |
   | `wh` | Capacity in watt-hours |
   | `cells` | Number of cells |
   | `confidence` | `high`, `medium`, or `low` |
   | `source_url` | Page that gave the part number |
   | `notes` | Free text |
   | `image` | Path to a photo in `img/`, for example `img/dell-mhr4g.jpg` |
   | `image_source` | Page the photo came from |
   | `image_note` | Caveat about the photo, for example when it shows an equivalent pack |
   | `charger_watts` | Wattage of the adapter the laptop shipped with |
   | `charger_connector` | Plug type, for example `USB-C` or `Dell 7.4mm barrel` |
   | `charger_output` | Voltage and current, for example `20V 3.25A` |
   | `charger_part_numbers` | OEM adapter part number(s), separated by `; ` |
   | `charger_confidence` | `high`, `medium`, or `low` |
   | `charger_source_url` | Page that gave the adapter data |
   | `charger_notes` | Other wattages or connectors that shipped with some configs |

2. Run the build script. It writes `data/batteries.js`, which the page loads.

   ```bash
   python3 scripts/build_data.py
   ```

3. Commit and push. GitHub Pages publishes the new data in about a minute.

## Deploy on GitHub Pages

1. Create an empty repository on GitHub, for example `battery-db`.
2. Push this folder to it:

   ```bash
   git remote add origin git@github.com:<user>/battery-db.git
   git push -u origin main
   ```

3. In the repository, open **Settings > Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, then save.
4. The site appears at `https://<user>.github.io/battery-db/`.

The favicons and the web manifest are in `icons/` and `favicon.ico`. The SVG in `icons/favicon.svg` is the master. The PNG and ICO files are exports of it.

All paths in the site are relative, so the sub-path works without any config.
The `.nojekyll` file stops GitHub from running Jekyll on the folder.

## Local preview

Open `index.html` in a browser, or run:

```bash
python3 -m http.server 8080
```

and open <http://localhost:8080/>.
