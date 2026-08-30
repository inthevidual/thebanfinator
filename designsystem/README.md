# Designsystem — importerat från lrstats (Svenska CP-Tjänst · Poddstatistik)

Formgivningen från `ledarredstats`, kopierad hit för att genomföras i
The Banfinator. **Läs `brand-book.md` först** — den är hela systemet, skriven
för att kunna läsas rakt av och genomföras. Den här filen säger bara vad som
ligger var, och vad som skaver mot just det här projektet.

```
brand-book.md          hela systemet, 12 kapitel
assets/fonts/          9 woff2 — SvD Ester Blenda, Sueca Hd, Sueca Tx
assets/brand/          ordmärket och det kvadratiska CP-märket
reference/             källfilerna som brand-bokens §12 pekar ut
  index.css            färgtokens och de tre temablocken — den viktigaste filen
  tailwind.config.js   semantiska alias, typsnittsfamiljer, radier, fade-in
  lib/palette.ts       den kategoriska skalan och regeln om att färg följer person
  lib/format.ts        sifferformatering, inklusive tankstrecket för saknat värde
  components/          Button, Badge, Card, Table, StatTile, Empty, LoadState,
                       Brand (inlinat ordmärke), HostAvatar, ChartFrame
```

`reference/` är originalkoden, inte exempel. Den är React + Tailwind. Läs den
som facit när brand-bokens klasslistor är otydliga — men skriv om den till det
som passar här (se nedan), kopiera den inte rakt av.

---

## Fyra krockar med The Banfinator, i tur och ordning

Det här projektet har redan en egen formgivning, och den är inte den här.
Innan något genomförs behöver de här fyra vara avgjorda — helst av Jesper,
inte gissade.

### 1. `data-theme` betyder två olika saker

Den allvarligaste, och den enda som går sönder tyst.

The Banfinator kör **daisyUI 5**, som styr sitt tema med `data-theme` på
`<html>` — just nu `data-theme="halloween"`. Brand-boken (§2.2) använder
**samma attribut** för `light`/`dark`. Följer man boken bokstavligt skriver man
över daisyUI:s tema, eller tvärtom, beroende på vem som skriver sist.

Välj en väg och håll den:

- **Byt ut daisyUI** mot tokenarkitekturen i §2.2. Renast, men allt som i dag
  får sin form från daisyUI-klasser (`btn`, `card`, `input`…) måste skrivas om.
- **Behåll daisyUI** och lägg tokenerna på ett eget attribut, t.ex.
  `data-scheme="light|dark"`, med samma tre block i övrigt. Boken gäller då
  ordagrant med attributnamnet utbytt.

Vad som *inte* fungerar: att låta båda skriva `data-theme`.

### 2. Två motsatta estetiker

lrstats är platt, varmt och tidningslikt: gräddvit botten, kall marinblå text,
knappt synliga skuggor, ingen rörelse på data. The Banfinator är neon på mörkt
— `.brand-title` har sex lager `text-shadow` och en flimmeranimation.

Det här är inte en bugg i någondera. Det är två olika produkter. Bestäm vad
Banfinator ska vara innan något färgvärde flyttas, för halvvägs blir sämre än
endera: en neonrubrik över en tidningspalett ser ut som ett misstag.

Det som går att ta rakt av **utan** att röra estetiken, och som är den bästa
avkastningen om ni bara vill ha en del:

- **§6 — sifferformatering.** `format.ts` är fristående och svensk. Framför allt
  tankstrecket: ett saknat värde är `–`, aldrig `0`.
- **§9 — ärlighetsreglerna.** Ett uteblivet svar får aldrig ritas ut som en
  nolla. Gäller oavsett hur sidan ser ut.
- **§4.4 — z-stegen** och de tre buggarna den finns till för att förhindra.
- **§10 — antimönstren.**

### 3. Typsnitten

Banfinator hämtar **Fira Sans + Fira Mono från Google Fonts**. Boken bygger på
tre självhostade serifer plus en sans för krom.

`assets/fonts/` ligger här som Jesper bad om. Men läs **§3.0**: typsnitten är
SvD:s egendom och självhostade i lrstats för att det är ett internt
SvD-verktyg. The Banfinator är en publik sajt på egen domän — det är en annan
sak, och inte min bedömning att göra. **Kolla licensen innan de läggs upp
publikt.** Vill ni ha strukturen utan frågan finns fria motsvarigheter i §3.0
som håller samma uppdelning.

Notera också de två luckorna i §3.1: Inter står först i stacken utan att
finnas med i bygget, och Sueca Tx laddas utan att användas någonstans. Ärv
inte de misstagen.

### 4. Märket

`assets/brand/` innehåller ordmärket *Svenska CP-Tjänst* och det kvadratiska
CP-märket. Banfinator kallar sig redan "a passion project ❤️ from CP-Tjänst",
så märket hör troligen hemma här — men projektet har egna märken
(`banf.svg`, `banfinator.svg`, `banfcowboy.svg`). Avgör vilket som är
avsändare och vilket som är undertecknare innan båda hamnar i sidhuvudet.

Ordmärket ritas inline som JSX just för att det ska följa `currentColor`
(§3.4). I en ren HTML-sida gäller samma sak — klistra in SVG:n i markupen och
sätt `fill: var(--logoColor, currentColor)`, ladda den inte som `<img>`.

---

## Ordning att genomföra i

Brand-bokens §11 är den fullständiga checklistan. Kortversionen för just det
här projektet:

1. Avgör punkt 1 och 2 ovan. Inget annat är meningsfullt före det.
2. Tokens och de tre temablocken (§2.2–2.5) in i en egen stilmall.
3. `format.ts` (§6), oförändrad.
4. `gate()` och den treställda grenen (§9.1) **innan** vyer byggs, inte efter.
   lrstats fick eftermontera det över nio sidor och tjugo anropsställen.
5. Komponenterna i §5, i ordning.
6. Finns diagram: **kör paletten genom dataviz-validatorn innan något ritas.**
   Sju-stegsskalan i §7.2 klarar angränsande par men faller på alla par — det
   står uppmätt i boken, med exakta ΔE-värden. Ärv inte skalan utan att läsa
   det stycket.
7. Genomgång mot §10.

Inget av det här är incheckat. Kopiorna ligger orörda i arbetskatalogen.
