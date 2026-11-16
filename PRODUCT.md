# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O usuário principal são os **jurados do NASA Space Apps Challenge 2026** (Desafio 14, Earth Jukebox). Eles avaliam muitos projetos em pouco tempo, pelos critérios de impacto, criatividade, validade, relevância e apresentação, e precisam entender em segundos o que o produto faz e por que ele é confiável.

Os públicos que o desafio pede para atender, e que os jurados vão ter em mente ao avaliar, são secundários no desenho mas definem o argumento do produto: público geral sem formação científica e pessoas que não conseguem ler uma visualização tradicional (cegas ou com baixa visão). Isso vem das notas do time, não de pesquisa com usuários.

## Product Purpose

O Earth Jukebox transforma eventos reais da Terra em uma experiência musical: o que se ouve, vê e sente é gerado em tempo real a partir de medições da NASA. A pergunta que o produto responde é "como fazer alguém perceber uma mudança na Terra sem depender apenas da visão?".

Sucesso, para o usuário principal, é o jurado sair convencido de três coisas: os dados são reais, o som codifica o dado (não é trilha decorativa) e a experiência é memorável o bastante para ser lembrada entre dezenas de projetos.

## Positioning

- **Uma regra musical para todos os fenômenos:** a intensidade escolhe a nota e o acorde, a velocidade de mudança escolhe o andamento. Quem aprende em um fenômeno consegue ouvir os outros.
- **Sotaque brasileiro:** os mesmos dados tocam baião (furacão), maracatu (vulcão e relâmpagos), samba (luzes da noite e CO₂), bossa nova (altura das florestas), e cada instrumento entra quando a medição cruza um limiar científico do fenômeno (por exemplo, as categorias Saffir-Simpson).
- **Medição no navegador:** a pluma do Hunga Tonga é medida pixel a pixel nos quadros infravermelhos do GOES-West, e a área acesa do planeta é medida nos quadros anuais de luzes noturnas do Earth Information Center (EIC), em tempo de execução.

## Operating Context

O produto é usado e avaliado em quatro situações, todas confirmadas como relevantes:

- demonstração ao vivo em notebook para a banca, com caixa de som ou fones, possivelmente com internet ruim;
- vídeo gravado da submissão, de cerca de 30 segundos a poucos minutos;
- celular do visitante, com fones e vibração;
- tela grande de exposição, com várias pessoas olhando juntas.

O time tem cinco pessoas (tech lead, UI/UX, design gráfico, dados e QA) na trilha Enterprise do hackathon. A demo ao vivo roda em hardware modesto: a máquina de desenvolvimento usa gráficos integrados Intel Iris Xe.

## Capabilities and Constraints

**Funciona hoje**

- Onze experiências, catalogadas na Home por fonte de dados. Quadros do EIC (visualizações do SVS, um motor só em `eic.html`): Luzes da noite (SVS 5313), Relâmpagos vistos da ISS (SVS 5011), Carbono no ar (SVS 5196), Altura da floresta (SVS 4950), Aerossóis (SVS 5669), Calor e correntes do mar (SVS 3912), Ar que respiramos (SVS 5533), Correntes do oceano (SVS 5425) e Rio atmosférico (SVS 4960). 9 dos 11 recursos do desafio são dados; o Caldwell 73 inspirou a varredura. Eventos da EONET e da GIBS: Furacão Helene e erupção do Hunga Tonga. O iceberg A23a foi removido para deixar o site mais leve.
- Luzes da noite (SVS 5313, Black Marble/VIIRS): 12 quadros anuais e o mapa de mudança, mapa plano com uma linha de varredura que toca um sino por lugar aceso (latitude escolhe a nota, longitude escolhe o lado) e, no mapa de mudança, notas agudas para mais luz e graves para menos luz.
- As outras quatro experiências do EIC (relâmpagos, CO₂, florestas e aerossóis) usam o mesmo motor: quadros cortados dos vídeos ou imagens do SVS, uma medida por tipo de pixel, e uma linha de varredura que toca um sino por coluna. Relâmpagos, CO₂ e florestas são globos que giram no vídeo, então a medida diz o que está à vista, não um valor mundial; o CO₂ e os aerossóis são saídas de modelos.
- Cena 3D em um globo real, com linha do tempo, câmeras e narrativa tocável ou arrastável.
- Dois sotaques musicais alternáveis: brasileiro (padrão) e universal (sintetizadores).
- Painel de física derivada das medições (pressão dinâmica do vento, intensificação rápida, onda de pressão do Tonga).
- Narração em voz dos marcos, vibração no celular, operação completa por teclado.
- Modo `?local`, que usa cópias locais das respostas reais da NASA e dispensa a rede.

**Restrições técnicas**

- Vite com páginas HTML separadas, Three.js para a cena, Tone.js para o áudio, sem backend próprio (só uma função, `api/tts.js`, que repassa a locução à ElevenLabs).
- O navegador só libera áudio depois de um gesto do usuário, então toda experiência começa com um toque.
- Precisa manter fluidez em gráficos integrados; a cena ajusta a própria resolução para isso.

**Termos do produto**

- *Fenômeno*: um dos onze eventos. *Sotaque*: o conjunto de instrumentos que toca a regra. *Regra*: o mapeamento intensidade para nota, velocidade para andamento.

**Em aberto (decidido conscientemente como não fixo)**

- O nome "Earth Jukebox" é o nome do desafio e pode mudar.
- A interface tem português, inglês (padrão do site) e espanhol. Textos gerados por JavaScript às vezes aparecem em português se a página carrega antes do idioma.
- O som dos dados é sintetizado no navegador, mas não é mais "nenhum som pré-gravado": há uma música de fundo gravada (feita no Suno, em `public/audio/rhythms/`) tocando por baixo do som do evento. Quem ouve escolhe entre baião, bossa nova, brega-funk, carimbó, maracatu, samba e xote, ou nenhuma; por padrão toca a do gênero do fenômeno. A interface e a documentação dizem isso.

## Brand Commitments

Um único compromisso foi fixado: **só dados reais da NASA**. Toda medição vem da EONET, da GIBS e do Earth Information Center; o que for modelo, estimativa ou ilustração é sempre rotulado como tal na interface.

## Evidence on Hand

- Trajetória e intensidade do Helene: EONET, com cópias em `public/data/`. Quadros e séries do EIC: `public/img/eic/` e `public/data/eic-*.json`, amostrados dos vídeos e imagens do SVS.
- Imagens de satélite: GIBS (NOAA-20, Aqua, Terra, GOES-West, Blue Marble, Black Marble), com cópias em `public/img/gibs/`.
- Quadros do EIC (SVS 5313, "Change in Night Lights between 2012 and 2023"): um quadro por ano e o mapa de mudança, cortados do vídeo oficial (os quadros EXR originais têm 20 a 35 MB cada) e salvos em `public/img/eic/nightlights/`. São imagens de visualização, não radiância calibrada: a medida só vale para comparar um ano com outro.
- Fontes citadas na interface: Matoza et al. (Science, 2022) para a onda de Lamb; Proud et al. (Science, 2022) para a altura de 57 km; Emanuel (Nature, 2005) para o poder destrutivo; critério de intensificação rápida do NHC; Dubus & Bresin (PLoS ONE, 2013) e Spence (2011) para os mapeamentos sonoros.
- Pesquisa do time sobre sinestesia e correspondências entre sentidos, nas notas do projeto.

**Não existe e não deve ser inventado:** testes com usuários, depoimentos, medição de acessibilidade com pessoas cegas, registro da onda de pressão do Tonga em barômetros brasileiros (a chegada a São Paulo é um modelo) e relâmpagos medidos na cena do Helene e do Tonga (são ilustrativos; os relâmpagos da experiência da ISS são medidos).

## Product Principles

1. **O dado manda no som.** Toda mudança audível tem uma medição por trás e a interface mostra qual.
2. **Música, não efeito sonoro.** Eventos pontuais (relâmpago, ruptura, explosão) entram como notas do acorde, no tempo da música.
3. **Honestidade sobre o que é medido.** Medido, modelado e ilustrativo nunca se confundem.
4. **Entendível em segundos.** Um jurado que olha por meio minuto precisa sair sabendo o que ouviu e por quê.
5. **Funciona sem a tela.** A experiência precisa fazer sentido de olhos fechados.

## Accessibility & Inclusion

Acessibilidade é o argumento central do desafio, não um extra. O produto se compromete com: som como canal primário de informação, teste de olhos fechados, narração em voz, vibração como canal tátil, operação por teclado e respeito à preferência de movimento reduzido. Nenhum padrão formal (como um nível WCAG) foi definido como meta.
