# Laptop Battery Finder!

A static, searchable database of laptop models and the OEM battery each one takes.
It runs on GitHub Pages with no build step and no server.

## Use the site

Type a laptop model, a brand, or a battery code. Type `soldered ram`, `upgradable ram`, `wwan`, or a GPU name such as `rtx` to find laptops by hardware. Results update as you type.
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
   | `ram_upgradable` | `yes` (all RAM in slots), `partial` (soldered RAM plus a slot), or `no` (all soldered) |
   | `ram_type` | Memory type, for example `DDR4-3200 SO-DIMM` or `LPDDR5 (soldered)` |
   | `ram_slots` | Number of memory slots the user can reach (`0` if none) |
   | `ram_max` | Maximum RAM the maker supports, for example `64 GB` |
   | `ram_confidence` | `high`, `medium`, or `low` |
   | `ram_source_url` | Page that gave the memory data |
   | `ram_notes` | Configurations that differ, for example soldered RAM on some SKUs |
   | `storage_upgradable` | `yes` (standard M.2 or 2.5in drive), `proprietary` (removable, non-standard module), or `no` (soldered) |
   | `storage_slots` | Number of drive slots or bays (`0` if soldered) |
   | `storage_type` | Drive form factor and bus, for example `M.2 2280 PCIe 4.0 NVMe` |
   | `wifi_upgradable` | `yes` (M.2 card in a socket) or `no` (soldered) |
   | `wifi_type` | The stock Wi-Fi card or chip, for example `Intel AX211 (M.2 2230 CNVi)` |
   | `wwan` | `yes` if the model has a WWAN (4G/5G) slot or factory option, else `no` |
   | `wwan_notes` | WWAN caveats, for example antennas only on WWAN-ready configs |
   | `gpu` | Graphics, for example `Integrated Intel Iris Xe` |
   | `gpu_upgradable` | `yes` only for a removable GPU module (MXM or similar), else `no` |
   | `parts_confidence` | `high`, `medium`, or `low` for the storage, Wi-Fi, WWAN and GPU data |
   | `parts_source_url` | Page that gave the storage, Wi-Fi, WWAN and GPU data |
   | `parts_notes` | Configurations that differ |
   | `replaceable_parts` | Parts the service manual lists as their own part, separated by `; ` |
   | `keyboard` | `separate` (own part) or `palmrest` (sold only with the palmrest) |
   | `screen` | `panel` (panel sold alone) or `assembly` (only the full display assembly) |
   | `charge_port` | `separate` (own part or daughter board) or `board` (on the system board) |
   | `fan` | `separate`, `heatsink` (sold only with the heatsink), or `none` (fanless) |
   | `service_manual_url` | Service manual or repair guide used for the repair data |
   | `repair_confidence` | `high`, `medium`, or `low` for the repair data |
   | `repair_notes` | Repair caveats, for example glued parts |
   | `replaceable_part_numbers` | OEM part numbers per part, for example `Keyboard: 5N20V43796, 5N20V43868 \| Fan: 5H40X89378` |
   | `pn_confidence` | `high` (service manual, FRU list or PartSurfer) or `medium` (parts sellers) |
   | `pn_source_url` | Page that gave the part numbers |
   | `pn_notes` | What the variants mean, for example which keyboard is backlit |

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
