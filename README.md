# 🕌 Namaz Prayer Timings App

A modern, fluid Islamic Prayer Timings Web Application and comprehensive engineering research repository.

- **GitHub Repository**: [https://github.com/hamidgazi/namaz](https://github.com/hamidgazi/namaz)
- **Live Web App**: [https://hamidgazi.github.io/namaz/](https://hamidgazi.github.io/namaz/)

---

## 🌟 Features & Capabilities

- **Accurate Prayer Calculations**: Comprehensive daily timings for Fajr, Sunrise, Dhuhr, Asr (Hanafi/Shafi'i), Maghrib, and Isha.
- **Fluid 60 FPS Mobile UX**: Responsive day-switching animations, smooth scroll mechanics, and clean prayer card layouts.
- **100% Offline PWA**: Backed by sw.js cache-first architecture and manifest.json for home screen installation.
- **Audio & Haptics**: Built-in notifications, azan audio alerts, and countdown to the next prayer.
- **Compact & Fast**: Zero external heavyweight frameworks, optimized for instant rendering on mobile devices.

---

## 🔬 Reverse Engineering & Research Kit

This project includes in-depth teardowns and comparative analysis of leading Android prayer applications:

- **PRAYER_TIMES_3_8_4_TEARDOWN.md**: Complete architectural breakdown of PrayerTimes v3.8.4, including solar calculation algorithms, qibla azimuth formulas, notification scheduling, and battery optimization strategies.
- **Apps Zip/**: Decompiled and extracted APK bundles for comparative study:
  - Awqat-e-Salah_4.7.0.apks.zip
  - Masjid Compass_3.7.8.apks.zip
  - PrayerTimes_3.8.4.apks.zip
  - Raza Prayer Times_1.0.25.apks.zip
  - Tauqeet_1.7.apks.zip

---

## 📁 Directory Structure

`
02-Namaz-Prayer-Times/
├── index.html                      # Main prayer timings PWA application
├── manifest.json                   # Web app manifest for installation
├── sw.js                           # Offline caching service worker
├── version.json                    # Version manifest
├── icon.svg, icon-*.png            # App icons (192px, 512px)
├── push_to_github.bat              # 1-Click script to commit & push to GitHub
├── PRAYER_TIMES_3_8_4_TEARDOWN.md  # In-depth architectural analysis doc
└── Apps Zip/                       # Benchmark reference APK archives
`

---

## 🚀 How to Deploy / Push Changes

Double-click:
`at
push_to_github.bat
`
This script will stage index.html, ersion.json, manifest.json, sw.js, and icons, create a commit, and push directly to GitHub main.
