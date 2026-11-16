<div align="center">

# 🌍 Earth Jukebox

### Hear the Earth change.

Real NASA measurements turned into music, so anyone can *perceive* a change on our planet, without depending on sight alone.

**[earthjukebox.us](https://earthjukebox.us)** · NASA Space Apps Challenge 2026 · Challenge 14

[![Live](https://img.shields.io/badge/live-earthjukebox.us-091127?style=for-the-badge)](https://earthjukebox.us)
![NASA data](https://img.shields.io/badge/data-100%25%20NASA-0b3d91?style=for-the-badge)
![Three.js](https://img.shields.io/badge/Three.js-000?style=for-the-badge&logo=threedotjs)
![Tone.js](https://img.shields.io/badge/Tone.js-f734d7?style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-646cff?style=for-the-badge&logo=vite&logoColor=white)

</div>

---

## What is it?

Earth Jukebox answers one question: **how do you make someone notice a change on Earth without relying only on vision?**

Eleven real events and datasets, from Hurricane Helene to the Hunga Tonga eruption to 12 years of city lights, are measured in your browser and played as music. What you hear, see and feel is generated live from the data. Nothing is a decorative soundtrack.

## One rule for every phenomenon

> **Intensity picks the note and the chord. Speed of change picks the tempo.**

Learn it on one phenomenon and you can already listen to the others. Instruments enter only when a measurement crosses a real scientific threshold (for example, the Saffir-Simpson hurricane categories).

### With a Brazilian accent 🇧🇷

The same data plays in different Brazilian rhythms. You can also switch to a universal synth accent.

| Phenomenon | Rhythm |
|---|---|
| Hurricane | Baião |
| Volcano, lightning | Maracatu |
| Night lights, CO₂ | Samba |
| Forest height | Bossa nova |

A recorded background track (made with Suno) plays under the live sound. Listeners can choose baião, bossa nova, brega-funk, carimbó, maracatu, samba, xote, or none.

## The experiences

**Events (NASA EONET + GIBS)**
- **Hurricane Helene**: track and intensity from EONET, with daily NOAA-20, Aqua and Terra frames.
- **Hunga Tonga eruption**: the plume is measured pixel by pixel in GOES-West infrared frames, with a derived physics panel (Lamb pressure wave, wind dynamic pressure, rapid intensification).

**Earth Information Center (NASA SVS visualizations)**, all in one engine:
Night lights (SVS 5313) · Lightning seen from the ISS (SVS 5011) · Carbon in the air (SVS 5196) · Forest height (SVS 4950) · Aerosols (SVS 5669) · Ocean heat and currents (SVS 3912) · Air we breathe (SVS 5533) · Ocean currents (SVS 5425) · Atmospheric river (SVS 4960)

A scan line sweeps the map and plays a bell for every lit place: latitude chooses the note, longitude chooses the side. On the night-lights change map, high notes mean more light and low notes mean less.

## Built to be accessible

- Full keyboard operation
- Spoken narration of key moments
- Phone vibration as a third sense
- Interface in **English**, **Português** and **Español**
- Respects reduced-motion preferences

## Honest about the data

The only brand commitment: **real NASA data only.** Anything that is a model, an estimate or an illustration is labelled as such in the interface. Sources cited include Matoza et al. (*Science*, 2022), Proud et al. (*Science*, 2022), Emanuel (*Nature*, 2005), the NHC rapid-intensification criterion, and Dubus & Bresin (*PLoS ONE*, 2013) for the sound mappings.

## Tech stack

| | |
|---|---|
| Build | [Vite](https://vite.dev), multi-page |
| 3D scene | [Three.js](https://threejs.org) (adaptive resolution for integrated GPUs) |
| Audio | [Tone.js](https://tonejs.github.io/), synthesized in the browser |
| Motion & charts | GSAP, D3 |
| Styling | Tailwind CSS v4 |
| Narration | ElevenLabs, through a tiny proxy so the API key never reaches the browser |
| Data | NASA EONET, GIBS, Earth Information Center / SVS, with local copies in `public/` |

## Run it locally

```bash
npm install
npm run dev
```

Open the address Vite prints. Browsers only unlock audio after a gesture, so every experience starts with a tap.

**No internet?** Add `?local` to any page address (e.g. `/helene.html?local`) to use the bundled copies of the real NASA responses.

### Narration (optional)

Narration goes through `/api/tts`. Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs key (server-side only) |
| `ELEVENLABS_VOICE_ID` | Voice to use |
| `ELEVENLABS_MODEL_ID` | Optional model override |

The same handler runs in the Vite dev server, as a Vercel function (`api/tts.js`), and as a standalone Node server (`server/index.js`) for self-hosting behind a reverse proxy.

### Build

```bash
npm run build
npm run preview
```

## Project structure

```
├── index.html, helene.html, tonga.html, nightlights.html, eic.html, docs.html
├── src/
│   ├── main/         entry point per page
│   ├── models/       data loading and sound mapping (SensoryMapper)
│   ├── controllers/  experience, audio and scene control
│   ├── views/        3D scene and UI
│   ├── components/   header, carousel, scroll narrator
│   ├── config/       real events behind each experience
│   ├── i18n/         pt-BR, en, es
│   └── styles/
├── public/           local NASA data copies, imagery, fonts, rhythms
├── api/tts.js        Vercel function for narration
└── server/           standalone narration server
```

## Team

Five people on the Enterprise track: tech lead, UI/UX, graphic design, data and QA.

## Credits

- Data: NASA EONET, NASA GIBS, NASA Earth Information Center, NASA Scientific Visualization Studio
- Background rhythms: generated with Suno
- Built for the **NASA Space Apps Challenge 2026**

---

<div align="center">

**🎧 Put on headphones and try it: [earthjukebox.us](https://earthjukebox.us)**

</div>
