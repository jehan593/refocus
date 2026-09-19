# Refocus

> FYI: This project is fully vibe coded.

Hide distracting clutter on the sites you choose.

## What it does

Refocus is a browser extension that hides unwanted sections on popular sites:

- X (Twitter) — For You tab, What's Happening, Today's News
- YouTube — Shorts button, suggestions, home page feed
- YouTube Music — home page suggestions
- Reddit — home page and sidebar navigation
- Facebook — home page feed
- WhatsApp — status button and channel suggestions

## How to install

1. Go to `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder

## How to use

Click the Refocus icon to open the popup. Use the toggles to turn hiding on or off per site or per section.

## How it works

Each rule in `filters.txt` targets a section on a site using its page structure. Rules are grouped by a header line starting with `!`, and each section has a short label on the line above it. The extension reads this file, shows the sections in the popup, and hides whichever ones you leave enabled.

## License

MIT