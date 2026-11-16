// Texts of the documentation page about the experiences made of NASA Earth Information Center
// frames, in three languages. Per-experience descriptions live in eicText.js; here are the
// sentences that wrap them (headings, table headers, the list of challenge resources used).
import { getLanguage } from "./index.js";

const D = {
  "pt-BR": {
    title: "Quadros do EIC: oito experiências",
    intro: "Oito experiências usam o mesmo motor (página eic.html: FramesModel, FramesScene e FramesController), e cada uma é um vídeo ou uma imagem da lista de recursos do desafio, medida pixel a pixel no navegador. A medida escolhe a nota e o acorde, a variação dela escolhe o andamento, e uma linha de varredura lê uma coluna do quadro a cada 120 ms e toca um sino do acorde para cada tipo de pixel que encontra.",
    colInput: "Entrada",
    colOutput: "Saída",
    colOrigin: "Origem",
    colMeasure: "Medida",
    measured: "medido",
    calculated: "calculado",
    note: "Nota e acorde",
    tempo: "Andamento",
    tempoFrom: "Variação da medida ao longo da linha do tempo",
    tempoOut: "60 a 150 BPM",
    noteOut: "Lá2 a Lá4",
    accents: "As oito reaproveitam instrumentos de ritmos brasileiros: relâmpagos e correntes do oceano tocam maracatu (as alfaias soam como trovão e como ondas), CO₂ e poluentes do ar tocam samba (a música das cidades), florestas e águas quentes tocam bossa nova (a música do mar e da copa das árvores), e aerossóis e o rio atmosférico tocam baião (a sanfona só soa com ar em movimento). O limiar de cada instrumento é uma faixa da própria medida.",
    sourcesTitle: "Recursos do desafio usados",
    sourcesIntro: "O desafio lista 11 visualizações da NASA como dados para o áudio. O projeto usa nove delas como quadros: o vídeo ou a imagem foi baixado do SVS, amostrado fora do navegador (12 ou 13 quadros por vídeo) e cada quadro é medido de novo no navegador. Os arquivos grandes ficam fora do repositório.",
    colSvs: "Recurso (SVS)",
    colFile: "Arquivo usado",
    colSize: "Tamanho",
    colUse: "Uso",
    notUsedTitle: "Os outros dois recursos da lista",
    notUsed: "A galeria do EIC (Content Database) é a origem de todas as visualizações acima. Data Sonification: Caldwell 73 (13786) usa dados de astronomia: inspirou a varredura (luminosidade e posição viram volume e altura), mas não é usado como dado.",
    refsPrefix: "NASA Scientific Visualization Studio.",
    overviewResources: "Recursos do desafio usados como dados: {list} (9 de 11).",
    catalogTitle: "Catálogo por fonte de dados",
    catalogIntro: "A Home separa as experiências pela fonte dos dados. Os quadros do EIC (visualizações do SVS) são os cinco primeiros; os eventos medidos pela EONET e pela GIBS vêm depois.",
    nightlights: {
      period: "2012 a 2023",
      title: "Change in Night Lights between 2012 and 2023, EIC Version",
      file: "vídeo MP4 oficial (um quadro por ano cortado dele)",
      size: "32,7 MB",
      use: "Área acesa do mapa e mapa de mudança",
    },
  },
  en: {
    title: "EIC frames: eight experiences",
    intro: "Eight experiences use the same engine (page eic.html: FramesModel, FramesScene and FramesController), and each is a video or an image from the challenge's list of resources, measured pixel by pixel in the browser. The measurement picks the note and the chord, its change picks the tempo, and a scan line reads one column of the frame every 120 ms and rings a chord bell for each kind of pixel it finds.",
    colInput: "Input",
    colOutput: "Output",
    colOrigin: "Origin",
    colMeasure: "Measurement",
    measured: "measured",
    calculated: "calculated",
    note: "Note and chord",
    tempo: "Tempo",
    tempoFrom: "Change of the measurement along the timeline",
    tempoOut: "60 to 150 BPM",
    noteOut: "A2 to A4",
    accents: "The eight reuse instruments of Brazilian rhythms: lightning and ocean currents play maracatu (the alfaias sound like thunder and like waves), CO₂ and air pollutants play samba (the music of the cities), forests and warm waters play bossa nova (the music of the sea and of the treetops), and aerosols and the atmospheric river play baião (the accordion only sounds with moving air). Each instrument's threshold is a band of the measurement itself.",
    sourcesTitle: "Challenge resources used",
    sourcesIntro: "The challenge lists 11 NASA visualizations as data for the audio. The project uses nine of them as frames: the video or image was downloaded from the SVS, sampled outside the browser (12 or 13 frames per video) and every frame is measured again in the browser. The large files stay out of the repository.",
    colSvs: "Resource (SVS)",
    colFile: "File used",
    colSize: "Size",
    colUse: "Use",
    notUsedTitle: "The other two resources on the list",
    notUsed: "The EIC gallery (Content Database) is the origin of all the visualizations above. Data Sonification: Caldwell 73 (13786) uses astronomy data: it inspired the sweep (luminosity and position become volume and pitch), but is not used as data.",
    refsPrefix: "NASA Scientific Visualization Studio.",
    overviewResources: "Challenge resources used as data: {list} (9 of 11).",
    catalogTitle: "Catalog by data source",
    catalogIntro: "The Home separates the experiences by the source of their data. The EIC frames (SVS visualizations) come first; the events measured by EONET and GIBS follow.",
    nightlights: {
      period: "2012 to 2023",
      title: "Change in Night Lights between 2012 and 2023, EIC Version",
      file: "official MP4 video (one frame per year cut from it)",
      size: "32.7 MB",
      use: "Lit area of the map and change map",
    },
  },
  es: {
    title: "Cuadros del EIC: ocho experiencias",
    intro: "Ocho experiencias usan el mismo motor (página eic.html: FramesModel, FramesScene y FramesController), y cada una es un video o una imagen de la lista de recursos del desafío, medida píxel a píxel en el navegador. La medida elige la nota y el acorde, su variación elige el tempo, y una línea de barrido lee una columna del cuadro cada 120 ms y toca una campana del acorde por cada tipo de píxel que encuentra.",
    colInput: "Entrada",
    colOutput: "Salida",
    colOrigin: "Origen",
    colMeasure: "Medida",
    measured: "medido",
    calculated: "calculado",
    note: "Nota y acorde",
    tempo: "Tempo",
    tempoFrom: "Variación de la medida a lo largo de la línea de tiempo",
    tempoOut: "60 a 150 BPM",
    noteOut: "La2 a La4",
    accents: "Las ocho reutilizan instrumentos de ritmos brasileños: relámpagos y corrientes del océano tocan maracatu (las alfaias suenan como trueno y como olas), CO₂ y contaminantes del aire tocan samba (la música de las ciudades), bosques y aguas cálidas tocan bossa nova (la música del mar y de las copas de los árboles), y aerosoles y el río atmosférico tocan baião (el acordeón solo suena con aire en movimiento). El umbral de cada instrumento es una franja de la propia medida.",
    sourcesTitle: "Recursos del desafío usados",
    sourcesIntro: "El desafío lista 11 visualizaciones de la NASA como datos para el audio. El proyecto usa nueve de ellas como cuadros: el video o la imagen se descargó del SVS, se muestreó fuera del navegador (12 o 13 cuadros por video) y cada cuadro se mide de nuevo en el navegador. Los archivos grandes quedan fuera del repositorio.",
    colSvs: "Recurso (SVS)",
    colFile: "Archivo usado",
    colSize: "Tamaño",
    colUse: "Uso",
    notUsedTitle: "Los otros dos recursos de la lista",
    notUsed: "La galería del EIC (Content Database) es el origen de todas las visualizaciones anteriores. Data Sonification: Caldwell 73 (13786) usa datos de astronomía: inspiró el barrido (luminosidad y posición se vuelven volumen y altura), pero no se usa como dato.",
    refsPrefix: "NASA Scientific Visualization Studio.",
    overviewResources: "Recursos del desafío usados como datos: {list} (9 de 11).",
    catalogTitle: "Catálogo por fuente de datos",
    catalogIntro: "La Home separa las experiencias por la fuente de sus datos. Los cuadros del EIC (visualizaciones del SVS) van primero; los eventos medidos por EONET y GIBS vienen después.",
    nightlights: {
      period: "2012 a 2023",
      title: "Change in Night Lights between 2012 and 2023, EIC Version",
      file: "video MP4 oficial (un cuadro por año cortado de él)",
      size: "32,7 MB",
      use: "Área encendida del mapa y mapa de cambio",
    },
  },
};

// Per experience: what the documentation table says about the file behind it.
export const SOURCES = {
  lightning: { svs: 5011, title: "Lightning Events Detected from the International Space Station (ISS) 2017-2023", file: "iss_lightning_sphere_07312023.mp4 (1920×1080)", size: "127 MB", credit: "Michala Garrison (SSAI)" },
  co2: { svs: 5196, title: "DYAMOND Global Carbon Dioxide", file: "dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4", size: "6,9 MB" },
  gedi: { svs: 4950, title: "GEDI Forest Height", file: "GEDI_global_w_colorbar_1080p60.mp4", size: "17,7 MB" },
  aerosols: { svs: 5669, title: "GEOS Aerosols (2025)", file: "Aerosols_2025-08-19T20_00_00_1920x1080.png", size: "2,8 MB" },
  sst: { svs: 3912, title: "Global Sea Surface Currents and Temperature", file: "ecco2_sst_flow.webmhd.webm (960×540)", size: "15,7 MB" },
  airquality: { svs: 5533, title: "Air Quality Model Runs", file: "AirQuality_Sphere_1920x1080_0000.png", size: "1,2 MB" },
  ocean: { svs: 5425, title: "Perpetual Ocean 2: Western Boundary Currents", file: "perpetual_ocean2_CLOSE_093_clean_noDate_1080p_carousel.jpg", size: "0,7 MB" },
  river: { svs: 4960, title: "A 3D View of an Atmospheric River from an Earth System Model", file: "atmos_river_HD.webm (1920×1080)", size: "72,9 MB" },
};

const PER = {
  lightning: { "pt-BR": ["2017 a 2023", "Relâmpagos do sensor LIS na ISS", "Área do globo coberta por relâmpagos"], en: ["2017 to 2023", "Lightning from the LIS sensor on the ISS", "Share of the globe covered by lightning"], es: ["2017 a 2023", "Relámpagos del sensor LIS en la ISS", "Área del globo cubierta por relámpagos"], use: { "pt-BR": "Área com relâmpagos e varredura por coluna", en: "Lightning area and column sweep", es: "Área con relámpagos y barrido por columna" } },
  co2: { "pt-BR": ["14 jan. a 3 mar. 2020", "Modelo DYAMOND de CO₂ (SVS 5196)", "Área do globo com CO₂ alto"], en: ["14 Jan to 3 Mar 2020", "DYAMOND CO₂ model (SVS 5196)", "Share of the globe with high CO₂"], es: ["14 ene. a 3 mar. 2020", "Modelo DYAMOND de CO₂ (SVS 5196)", "Área del globo con CO₂ alto"], use: { "pt-BR": "Área laranja e varredura por coluna", en: "Orange area and column sweep", es: "Área naranja y barrido por columna" } },
  gedi: { "pt-BR": ["abr. 2019 a abr. 2020", "Lidar GEDI na ISS (SVS 4950)", "Altura média da floresta à vista"], en: ["Apr 2019 to Apr 2020", "GEDI lidar on the ISS (SVS 4950)", "Mean height of the forest in view"], es: ["abr. 2019 a abr. 2020", "Lidar GEDI en la ISS (SVS 4950)", "Altura media del bosque a la vista"], use: { "pt-BR": "Altura lida na barra de cores e varredura por faixa", en: "Height read off the color bar and sweep by band", es: "Altura leída en la barra de colores y barrido por franja" } },
  aerosols: { "pt-BR": ["19 ago. 2025", "Modelo GEOS de aerossóis (SVS 5669)", "Área do mapa nos tipos que já tocam"], en: ["19 Aug 2025", "GEOS aerosol model (SVS 5669)", "Share of the map in the kinds already playing"], es: ["19 ago. 2025", "Modelo GEOS de aerosoles (SVS 5669)", "Área del mapa en los tipos que ya suenan"], use: { "pt-BR": "Quatro tipos de aerossol, um instrumento cada", en: "Four kinds of aerosol, one instrument each", es: "Cuatro tipos de aerosol, un instrumento cada uno" } },
  sst: { "pt-BR": ["sem datas no vídeo", "Modelo ECCO2 de correntes e temperatura (SVS 3912)", "Área do mapa em águas quentes"], en: ["no dates in the video", "ECCO2 currents and temperature model (SVS 3912)", "Share of the map in warm water"], es: ["sin fechas en el video", "Modelo ECCO2 de corrientes y temperatura (SVS 3912)", "Área del mapa en aguas cálidas"], use: { "pt-BR": "Área quente por quadro e varredura por cor", en: "Warm area per frame and sweep by color", es: "Área cálida por cuadro y barrido por color" } },
  airquality: { "pt-BR": ["jul. a ago. 2024", "Sistema GEOS-CF de poluentes (SVS 5533)", "Área do quadro nos poluentes que já tocam"], en: ["Jul to Aug 2024", "GEOS-CF pollutant system (SVS 5533)", "Share of the frame in the pollutants already playing"], es: ["jul. a ago. 2024", "Sistema GEOS-CF de contaminantes (SVS 5533)", "Área del cuadro en los contaminantes que ya suenan"], use: { "pt-BR": "Três poluentes, um instrumento cada", en: "Three pollutants, one instrument each", es: "Tres contaminantes, un instrumento cada uno" } },
  ocean: { "pt-BR": ["um quadro do vídeo", "Modelo de correntes oceânicas (SVS 5425)", "Área do quadro nas camadas que já tocam"], en: ["one frame of the video", "Ocean currents model (SVS 5425)", "Share of the frame in the layers already playing"], es: ["un cuadro del video", "Modelo de corrientes oceánicas (SVS 5425)", "Área del cuadro en las capas que ya suenan"], use: { "pt-BR": "Fluxos fundos e da superfície, um instrumento cada", en: "Deep and surface flows, one instrument each", es: "Flujos profundos y de la superficie, un instrumento cada uno" } },
  river: { "pt-BR": ["sem datas no vídeo", "Reanálise MERRA-2, vista em 3D (SVS 4960)", "Área do quadro no azul do vapor d'água"], en: ["no dates in the video", "MERRA-2 reanalysis, in 3D (SVS 4960)", "Share of the frame in the blue of the water vapor"], es: ["sin fechas en el video", "Reanálisis MERRA-2, en 3D (SVS 4960)", "Área del cuadro en el azul del vapor de agua"], use: { "pt-BR": "Vapor d'água por quadro e varredura por tipo", en: "Water vapor per frame and sweep by kind", es: "Vapor de agua por cuadro y barrido por tipo" } },
};

export const dt = (key, vars = {}) => {
  let v = D[getLanguage()]?.[key] ?? D["pt-BR"][key] ?? key;
  if (typeof v !== "string") return v;
  for (const [k, r] of Object.entries(vars)) v = v.replaceAll(`{${k}}`, String(r));
  return v;
};
export const dtNightlights = () => D[getLanguage()]?.nightlights ?? D["pt-BR"].nightlights;
export const per = (id) => {
  const lang = PER[id][getLanguage()] ? getLanguage() : "pt-BR";
  const [period, source, input] = PER[id][lang];
  return { period, source, input, use: PER[id].use[lang] };
};
