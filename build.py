#!/usr/bin/env python3
"""Generates the artisan-pisciniste.fr static site.
Usage: build.py prod  <out_dir>   -> files ready to upload to Hostinger (public_html)
       build.py preview <out_dir> -> self-contained variant for the Claude artifact preview
"""
import json, re, sys, os, shutil, html, datetime
from PIL import Image, ImageDraw

MODE, OUT = sys.argv[1], sys.argv[2]
PROD = MODE == 'prod'
S = os.path.dirname(os.path.abspath(__file__))
DOMAIN = 'https://artisan-pisciniste.fr'
TODAY = datetime.date(2026, 11, 9).isoformat()

if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(f'{OUT}/assets/img'); os.makedirs(f'{OUT}/assets/fonts'); os.makedirs(f'{OUT}/assets/vendor')

# ---------- links ----------
def url(slug):
    """Internal link to a page. prod: clean URL (/slug). preview: relative file."""
    if PROD: return '/' if slug == '' else '/' + slug
    return 'index.html' if slug == '' else slug + '.html'
A = '/assets/' if PROD else 'assets/'

# ---------- images ----------
def webp(src, name, w, q=72, crop=None):
    im = Image.open(src).convert('RGB')
    if crop: im = im.crop(crop)
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(f'{OUT}/assets/img/{name}.webp', 'WEBP', quality=q, method=6)
    return f'{A}img/{name}.webp', im.width, im.height

def og(src, name):
    im = Image.open(src).convert('RGB'); W, H = 1200, 630
    r = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    im.crop((l, t, l + W, t + H)).save(f'{OUT}/assets/img/{name}.jpg', 'JPEG', quality=80, optimize=True, progressive=True)
    return f'{DOMAIN}/assets/img/{name}.jpg'

IMG = {}
for key, src, w in [('hero', 'img/img_8341.jpg', 1800), ('rect', 'img/pc28904jpg_63b53ddad9e2f7.63969944.jpg', 1400),
                    ('mini', 'img/fp2.jpg', 1400), ('tanna', 'sup/m-tanna.jpg', 1800), ('olivier', 'img/olivier.webp', 1100), ('stone', 'img/fp4.jpg', 1400),
                    ('local', 'dl/local-technique.jpg', 1400), ('hivernage', 'dl/hivernage.jpg', 1400),
                    ('filtration', 'dl/filtration.jpg', 1400), ('tendances', 'dl/tendances.jpg', 1400)]:
    IMG[key] = webp(f'{S}/{src}', key, w)
# QR code: keep crisp PNG
Image.open(f'{S}/img/qr.jpg').convert('L').resize((360, 360)).save(f'{OUT}/assets/img/qr.png', optimize=True)
# Logo + icons
logo = Image.open(f'{S}/logo/crop.png').convert('RGBA')
for size, name in [(256, 'logo'), (512, 'logo-512'), (180, 'apple-touch-icon'), (48, 'favicon-48')]:
    logo.resize((size, size), Image.LANCZOS).save(f'{OUT}/assets/img/{name}.png', optimize=True)
OG = {k: og(f'{S}/{p}', 'og-' + k) for k, p in [('home', 'img/img_8341.jpg'), ('rect', 'img/pc28904jpg_63b53ddad9e2f7.63969944.jpg'),
      ('stone', 'img/fp4.jpg'), ('local', 'dl/local-technique.jpg'), ('hivernage', 'dl/hivernage.jpg'),
      ('filtration', 'dl/filtration.jpg'), ('tendances', 'dl/tendances.jpg')]}

Image.open(f'{S}/img/olivier.webp').convert('RGB').crop((110, 20, 540, 450)).resize((132, 132), Image.LANCZOS).save(f'{OUT}/assets/img/olivier-face.webp', 'WEBP', quality=80)
shutil.copy(f'{S}/dl/three.min.js', f'{OUT}/assets/vendor/three.min.js')
shutil.copy(f'{S}/dl/geist-latin.woff2', f'{OUT}/assets/fonts/geist-latin.woff2')

# ---------- articles ----------
PAGES = json.load(open(f'{S}/pages.json'))
MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
def frdate(iso):
    d = datetime.date.fromisoformat(iso[:10]); return f'{d.day} {MONTHS[d.month-1]} {d.year}'

ART = [  # slug, tag, image key (None = drawn cover), og key, seo title (kept close to the old one)
 ('la-revolution-des-piscines-coques-polyester-dans-le-morbihan', 'Dossier', 'stone', 'stone', 'Artisan pisciniste dans le Morbihan : installation de coques polyester'),
 ('fourniture-et-mise-en-place-de-piscines-coque-polyester-dans-le-morbihan', 'Construction', 'rect', 'rect', 'Fourniture et mise en place de piscines coque polyester dans le Morbihan'),
 ('les-avantages-des-minipiscines-de-moins-de-10-m-dans-le-morbihan-', 'Mini piscine', 'stone', 'stone', 'Les avantages des mini piscines de moins de 10 m² dans le Morbihan'),
 ('confection-de-locaux-techniques-optimisation-hydrauliques-domotique-dans-le-morbihan-', 'Équipement', 'local', 'local', 'Locaux techniques, hydraulique et domotique de piscine dans le Morbihan'),
 ('solutions-techniques-pour-le-chauffage-de-piscine-un-guide-detaille', 'Équipement', None, 'home', 'Chauffage de piscine : solaire, pompe à chaleur, réchauffeur électrique'),
 ('limportance-cruciale-de-lentretien-de-la-filtration-pour-les-piscines-privees', 'Entretien', 'filtration', 'filtration', "L'importance de l'entretien de la filtration pour les piscines privées"),
 ('hivernage-et-estivage-de-piscines-dans-le-morbihan-limportance-dun-entretien-regulier', 'Entretien', 'hivernage', 'hivernage', "Hivernage et remise en route de piscine dans le Morbihan"),
 ('tendances-du-marche-des-piscines-residentielles', 'Tendances', 'tendances', 'tendances', 'Tendances du marché des piscines résidentielles'),
]
COVER_ALT = {'stone': "Petite piscine coque avec banquette, entourée d'un muret en pierre", 'rect': 'Piscine coque rectangulaire posée dans un jardin engazonné',
  'local': "Local technique de piscine : filtre à sable, pompe et vannes de distribution", 'filtration': "Vue sous l'eau du fond carrelé d'une piscine",
  'hivernage': 'Bassin vidé pendant un chantier de rénovation', 'tendances': "Bouée gonflable sur une piscine au bord de la mer"}

OLD_HOST = re.compile(r'https?://(?:www\.)?artisan-pisciniste\.fr/?([^"#?]*)')
def clean(h):
    h = re.sub(r'\s(?:style|dir|class|target)="[^"]*"', '', h)
    h = re.sub(r'</?span>', '', h); h = re.sub(r'</?u>', '', h)
    h = h.replace('&nbsp;', ' ')
    h = OLD_HOST.sub(lambda m: 'href-internal:' + m.group(1), h)
    h = re.sub(r'href="href-internal:([^"]*)"', lambda m: f'href="{url(m.group(1).strip("/"))}"', h)
    h = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" rel="noopener"', h)
    # headings: long h3 are paragraphs in disguise; other h3/h4 become h2
    def hd(m):
        inner = m.group(2); txt = re.sub('<[^>]+>', '', inner).strip()
        if len(txt) > 160: return f'<p>{inner}</p>'
        return f'<h2>{re.sub(r"</?strong>", "", inner).strip()}</h2>'
    h = re.sub(r'<(h[1-6])>(.*?)</\1>', hd, h, flags=re.S)
    # a paragraph made only of bold text is a heading
    h = re.sub(r'<p><strong>([^<]{3,140})</strong></p>', lambda m: f'<h2>{m.group(1).strip().rstrip(" :")}</h2>', h)
    h = re.sub(r'<p>\s*</p>', '', h)
    return h

articles = []
for slug, tag, ik, ogk, seo in ART:
    p = PAGES[slug]
    body = ''.join(clean(i[1]) for i in p['items'] if i[0] == 'text')
    title = p['name'].strip().rstrip(' :').strip()
    # first heading duplicating the title -> becomes the H1 text, removed from body
    m = re.match(r'\s*<h2>(.*?)</h2>', body)
    if m and (m.group(1).lower()[:30] == title.lower()[:30]):
        title = m.group(1); body = body[m.end():]
    desc = (p.get('meta') or {}).get('description', '').strip()
    if slug.startswith('la-revolution'):
        desc = "Plus de 25 ans d'expérience dans l'installation de coques polyester et de mini piscines dans le Morbihan. Un artisan pisciniste à Elven, du conseil à la mise en eau."
    words = len(re.sub('<[^>]+>', ' ', body).split())
    articles.append(dict(slug=slug, tag=tag, img=ik, og=OG[ogk], seo=seo, title=title, body=body, desc=desc,
        date=p.get('date'), mins=max(2, round(words / 200)), author='Olivier Rousseau'))
dated = sorted([a for a in articles if a['date']], key=lambda a: a['date'], reverse=True)
articles_sorted = [a for a in articles if not a['date']] + dated

# ---------- suppliers ----------
for f in ['logo-mdp.svg', 'logo-cdl.svg']:
    shutil.copy(f'{S}/sup/{f}', f'{OUT}/assets/img/{f}')
_l = Image.open(f'{S}/sup/logo-fpc.png').convert('RGBA'); _l = _l.crop(_l.getbbox())
_l.resize((360, round(_l.height * 360 / _l.width)), Image.LANCZOS).save(f'{OUT}/assets/img/logo-fpc.png', optimize=True)
SUPPLIERS = [
 dict(id='fpc', name='France Piscines Composites', logo='logo-fpc.png', site='https://www.francepiscinescomposites.com/',
      pitch="Coques polyester fabriquées en France : mini piscines de moins de 10 m², bassins rectangulaires, escaliers d'angle ou romans. Notre partenaire historique.",
      models=[
        ('Tanna', 'tanna', '4,25 × 2,35 m', '1,50 m', "Notre modèle le plus demandé, ici en gris. Escalier d'angle", 'https://www.francepiscinescomposites.com/details-piscine+coque+polyester+de+moins+de+10m2+a+fond+plat+avec+escalier+d+angle+modele+tanna-108002', True),
        ('Wallis', 'wallis', '4,40 × 2,25 m', '1,40 m', "Escalier discret et banquette généreuse", 'https://www.francepiscinescomposites.com/details-piscine+coque+polyester+de+moins+de+10m2+a+fond+plat+avec+escalier+d+angle+modele+wallis-7639', True),
        ('Cuba', 'cuba', '7,00 × 3,70 m', '1,50 m', "Banquette et lignes arrondies, pour nager en famille", 'https://www.francepiscinescomposites.com/details-piscine+coque+polyester+avec+banquette+modele+cuba-45', False)]),
 dict(id='mdp', name='Mon de Pra', logo='logo-mdp.svg', site='https://www.piscinesmondepra.com/fr/piscines/',
      pitch="Une gamme très large de coques polyester, des petits bassins aux piscines de nage, avec plages immergées et couvertures intégrées.",
      models=[
        ('Wide', 'wide', 'dès 6,50 × 3,70 m', '1,50 m', 'Large marche de détente, fond plat', 'https://www.piscinesmondepra.com/fr/piscines/wide/', False),
        ('Bay', 'bay', 'dès 7,00 × 3,60 m', '1,50 m', "Zone plage intégrée pour bronzer dans l'eau", 'https://www.piscinesmondepra.com/fr/piscines/bay/', False),
        ('Pixel', 'pixel', '3,60 × 2,43 m', '1,30 m', 'Hors-sol autoportante, se pose presque partout', 'https://www.piscinesmondepra.com/fr/piscines/pixel/', True)]),
 dict(id='cdl', name='Ceramic de Luxe', logo='logo-cdl.svg', site='https://www.ceramicdeluxe.com/fr/',
      pitch="La gamme premium du groupe Mon de Pra : des piscines préfabriquées au design soigné, pensées pour les jardins contemporains.",
      models=[
        ('Leonis 45', 'leonis', '4,10 × 2,43 m', '1,50 m', 'Compacte, moins de 10 m²', 'https://www.ceramicdeluxe.com/fr/piscines/leonis/', True),
        ('Nova', 'nova', 'dès 6,50 × 3,60 m', '1,50 m', 'Lignes pures et contemporaines', 'https://www.ceramicdeluxe.com/fr/piscines/nova/', False),
        ('Lyra 77', 'lyra', '7,00 × 3,60 m', '1,50 m', 'Grande plage de 2,20 × 1,76 m', 'https://www.ceramicdeluxe.com/fr/piscines/lyra/', False)]),
]
for _s in SUPPLIERS:
    for _m in _s['models']:
        IMG['m-' + _m[1]] = webp(f'{S}/sup/m-{_m[1]}.jpg', 'm-' + _m[1], 1100, 70)

def suppliers_html():
    tabs = ''.join(
        f'<button type="button" role="tab" id="tab-{s["id"]}" aria-controls="sp-{s["id"]}" aria-selected="{"true" if i == 0 else "false"}" tabindex="{0 if i == 0 else -1}"><img src="{A}img/{s["logo"]}" alt="{html.escape(s["name"])}" loading="lazy"></button>'
        for i, s in enumerate(SUPPLIERS))
    panels = ''
    for i, s in enumerate(SUPPLIERS):
        cards = ''
        for m in s['models']:
            im = IMG['m-' + m[1]]
            badge = '<span class="b10">Moins de 10 m²</span>' if m[6] else ''
            cards += (f'<a class="model" href="{m[5]}" rel="noopener" target="_blank"><div class="mph">'
                      f'<img src="{im[0]}" alt="Piscine {html.escape(s["name"])}, modèle {html.escape(m[0])}" width="{im[1]}" height="{im[2]}" loading="lazy">{badge}</div>'
                      f'<div class="mtx"><h4>{html.escape(m[0])}</h4><p>{html.escape(m[4])}</p>'
                      f'<dl><div><dt>Dimensions</dt><dd>{m[2]}</dd></div><div><dt>Profondeur</dt><dd>{m[3]}</dd></div></dl>'
                      f'<span class="more">Voir le modèle</span></div></a>')
        hid = '' if i == 0 else ' hidden'
        panels += (f'<div class="sp" role="tabpanel" id="sp-{s["id"]}" aria-labelledby="tab-{s["id"]}"{hid}>'
                   f'<div class="sp-head"><div><h3>{html.escape(s["name"])}</h3><p>{html.escape(s["pitch"])}</p></div>'
                   f'<a class="pill pill-ink" href="{s["site"]}" rel="noopener" target="_blank">Voir toute la gamme</a></div>'
                   f'<div class="models">{cards}</div></div>')
    return ('<section class="band" id="fournisseurs"><div class="wrap">'
            '<div class="head up"><span class="eyebrow">Nos fournisseurs de piscines</span>'
            '<h2 class="h-l">Des coques de fabricants reconnus.<br>Posées par un artisan.</h2>'
            "<p class=\"lede\">Olivier travaille avec trois fabricants de piscines coques. Il vous aide à choisir le modèle adapté à votre terrain, puis s'occupe de la pose, des réseaux et de la mise en eau.</p></div>"
            f'<div class="seg" role="tablist" aria-label="Fabricants">{tabs}</div>{panels}'
            '<p class="fine" style="text-align:center;margin:28px auto 0">Modèles présentés à titre d\'exemple. Dimensions indicatives relevées sur les sites des fabricants ; d\'autres tailles et modèles sont disponibles sur devis. Photos : © France Piscines Composites, Mon de Pra, Ceramic de Luxe.</p>'
            '</div></section>\n')

SUP_CSS = r"""
/* ---------- suppliers ---------- */
.seg{display:flex;gap:6px;padding:6px;background:#eef1f6;border-radius:22px;width:max-content;max-width:100%;margin:0 auto clamp(32px,5vw,52px);overflow-x:auto}
.seg button{border:0;cursor:pointer;background:transparent;border-radius:16px;padding:12px 22px;display:grid;place-items:center;transition:background .3s,box-shadow .3s;flex:0 0 auto}
.seg button img{height:50px;width:auto;max-width:170px;object-fit:contain;filter:grayscale(1);opacity:.55;transition:filter .3s,opacity .3s}
.seg button[aria-selected="true"]{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.08),0 8px 24px -10px rgba(5,10,31,.35)}
.seg button[aria-selected="true"] img,.seg button:hover img{filter:none;opacity:1}
@media (max-width:560px){.seg{width:100%;justify-content:space-between}.seg button{padding:8px 10px}.seg button img{height:34px;max-width:96px}}
.sp-head{display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:26px}
.sp-head h3{font-size:clamp(24px,2.6vw,32px);font-weight:650}
.sp-head p{color:var(--ink-2);max-width:60ch;margin-top:8px}
.models{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
@media (max-width:900px){.models{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:600px){.models{grid-template-columns:1fr}}
.model{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:24px;overflow:hidden;color:var(--ink);min-width:0;transition:transform .5s cubic-bezier(.2,.8,.2,1),box-shadow .5s}
.model:hover{text-decoration:none;transform:translateY(-4px);box-shadow:0 30px 60px -30px rgba(5,10,31,.4)}
.mph{position:relative;aspect-ratio:16/10;overflow:hidden;background:var(--mist)}
.mph img{width:100%;height:100%;object-fit:cover;transition:transform 1s cubic-bezier(.2,.8,.2,1)}
.model:hover .mph img{transform:scale(1.06)}
.b10{position:absolute;left:14px;top:14px;background:rgba(5,10,31,.72);color:#fff;font-size:12px;font-weight:600;padding:6px 10px;border-radius:99px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.mtx{padding:20px 22px 22px;display:grid;gap:8px}
.mtx h4{margin:0;font-family:var(--display);font-size:22px;font-weight:650;letter-spacing:-.02em}
.mtx p{font-size:15px;color:var(--ink-2)}
.mtx dl{display:flex;gap:24px;margin:6px 0 4px}
.mtx dt{font-size:12px;color:var(--ink-2)}
.mtx dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
.mtx .more{font-size:15px;color:var(--link)}
@media (prefers-reduced-motion:no-preference){.sp:not([hidden]){animation:spin .6s cubic-bezier(.2,.8,.2,1)}@keyframes spin{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}}
"""
SUP_JS = r"""
/* ===== Supplier tabs ===== */
(()=>{const tabs=[...document.querySelectorAll('.seg [role=tab]')];if(!tabs.length)return;
const sel=t=>{tabs.forEach(b=>{const on=b===t;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;document.getElementById(b.getAttribute('aria-controls')).hidden=!on;});};
tabs.forEach((b,i)=>{b.addEventListener('click',()=>sel(b));b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(d){const n=tabs[(i+d+tabs.length)%tabs.length];sel(n);n.focus();}});});})();
"""

# ---------- shared pieces ----------
TPL = open(f'{S}/template.html').read()
CSS = TPL.split('<style>', 1)[1].split('</style>', 1)[0]
FONT = (f"@font-face{{font-family:'Geist';font-style:normal;font-weight:400 700;font-display:swap;src:url({A}fonts/geist-latin.woff2) format('woff2');"
        "unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n")
EXTRA_CSS = r"""
/* ---------- inner pages ---------- */
.inner-page{padding-top:calc(env(safe-area-inset-top,0px) + var(--navh))}
.nav .menu{display:none;margin-left:12px;background:none;border:0;color:inherit;cursor:pointer;padding:8px;border-radius:8px}
.nav .menu svg{width:20px;height:20px;display:block}
@media (max-width:1180px){
  .nav .menu{display:block;color:#fff}
  .nav.solid .menu{color:var(--nav-ink)}
  .nav.open{background:var(--nav-bg);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px)}
  .nav.open .menu{color:var(--nav-ink)}
  .nav.open .brand{color:var(--nav-ink)}
  .nav.open{background:var(--paper)}
  .nav.open ul{display:grid;position:absolute;top:var(--navh);left:0;right:0;gap:0;padding:8px var(--gr) 16px var(--gl);background:var(--paper);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--line)}
  .nav.open ul a{display:block;padding:12px 0;font-size:17px;color:var(--nav-ink);border-bottom:1px solid var(--line)}
}
.brand,.nav .pill{white-space:nowrap}
@media (max-width:420px){.brand span{display:none}.nav .wrap{gap:12px}}
.readbar{position:fixed;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + var(--navh));height:2px;z-index:49;background:transparent}
.readbar span{display:block;height:100%;background:var(--brand);transform-origin:left;transform:scaleX(var(--p,0))}
.crumbs{font-size:13px;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:6px;padding-top:28px;list-style:none;margin:0;padding-left:0}
.crumbs li+li::before{content:"›";margin-right:6px;color:var(--ink-2)}
.crumbs a{color:var(--ink-2)}
.art-head{display:grid;gap:18px;padding-block:clamp(28px,5vw,56px) clamp(28px,4vw,44px);max-width:860px}
.art-head h1{font-size:clamp(34px,5.4vw,60px);font-weight:700;line-height:1.06}
.byline{display:flex;align-items:center;gap:12px;color:var(--ink-2);font-size:15px}
.byline img{flex:0 0 auto}
.byline img{width:44px;height:44px;border-radius:50%;object-fit:cover}
.byline b{color:var(--ink);font-weight:600}
.cover{margin:0;border-radius:28px;overflow:hidden;background:var(--mist);aspect-ratio:21/9;max-width:100%}
.cover img{width:100%;height:100%;object-fit:cover}
article .cover img{transform:scale(1.14) translateY(calc(var(--py,0) * 1px));will-change:transform}
.cover.art{display:grid;place-items:center;background:radial-gradient(120% 140% at 20% 0%,#1b2a78,#050a1f 70%)}
.cover.art svg{width:min(560px,80%);height:auto}
@media (max-width:640px){.cover{aspect-ratio:4/3;border-radius:20px}}
.prose{max-width:68ch;margin:clamp(36px,6vw,64px) auto 0;font-size:19px;line-height:1.65;color:var(--ink)}
.prose>*+*{margin-top:1.1em}
.prose h2{font-size:clamp(24px,2.6vw,30px);font-weight:650;letter-spacing:-.02em;line-height:1.2;margin-top:1.9em}
.prose h2+*{margin-top:.6em}
.prose a{text-decoration:underline;text-underline-offset:3px}
.prose ol,.prose ul{padding-left:1.3em}
.prose li+li{margin-top:.5em}
.prose strong{font-weight:600}
.cta-box{max-width:68ch;margin:clamp(48px,7vw,80px) auto 0;background:var(--deep);color:var(--on-deep);border-radius:28px;padding:clamp(26px,4vw,44px);display:grid;gap:14px;position:relative;overflow:hidden;isolation:isolate}
.cta-box::before{content:"";position:absolute;inset:-40% -20% auto auto;width:70%;aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,rgba(79,112,255,.55),transparent);z-index:-1}
.cta-box h2{font-size:clamp(26px,3vw,34px);font-weight:700}
.cta-box p{color:var(--on-deep-2)}
.cta-box .row2{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-top:6px}
.cta-box .row2 span{color:var(--on-deep);font-weight:600;user-select:all}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
@media (max-width:900px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:600px){.cards{grid-template-columns:1fr}}
.card{display:flex;flex-direction:column;gap:10px;color:var(--ink);min-width:0}
.card:hover{text-decoration:none}
.card .ph{border-radius:22px;overflow:hidden;aspect-ratio:3/2;background:var(--mist)}
.card .ph>.cover{height:100%}
.card .ph img,.card .ph .cover{width:100%;height:100%;object-fit:cover;transition:transform .9s cubic-bezier(.2,.8,.2,1);border-radius:0;aspect-ratio:auto}
.card:hover .ph img{transform:scale(1.05)}
.card h3{font-size:21px;font-weight:650;letter-spacing:-.015em;line-height:1.25;transition:color .2s}
.card:hover h3{color:var(--link)}
.card p{font-size:15px;color:var(--ink-2)}
.card .meta{font-size:13px;color:var(--ink-2)}
.card.feature{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:clamp(20px,4vw,48px);align-items:center}
.card.feature h3{font-size:clamp(26px,3.2vw,40px);letter-spacing:-.025em;line-height:1.1}
@media (max-width:760px){.card.feature{grid-template-columns:1fr}}
.legal{max-width:72ch}
.legal h2{font-size:24px;margin-top:1.6em}
.e404{min-height:70vh;display:grid;place-items:center;text-align:center}
.consent{grid-column:1/-1;font-size:12px;color:var(--ink-2);line-height:1.5}
.hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}
"""
# The home "journal" grid is replaced by cards; drop its old block CSS is harmless.
SITE_CSS = FONT + CSS + EXTRA_CSS + SUP_CSS

if PROD:
    open(f'{OUT}/assets/site.css', 'w').write(SITE_CSS)

NAV_ITEMS = [('/#savoir-faire' if PROD else 'index.html#savoir-faire', 'Savoir-faire'), ('/#interlocuteur' if PROD else 'index.html#interlocuteur', 'Interlocuteur unique'), ('/#projet' if PROD else 'index.html#projet', 'Votre projet'),
             ('/#mini-piscine' if PROD else 'index.html#mini-piscine', 'Mini piscine'), ('/#fournisseurs' if PROD else 'index.html#fournisseurs', 'Fournisseurs'), ('/#avis' if PROD else 'index.html#avis', 'Avis clients'),
             (url('blog-list'), 'Conseils')]
def nav(home=False, current=None):
    items = ''.join(f'<li><a href="{("#" + h.split("#")[1]) if home and "#" in h else h}"{" aria-current=page" if t == current else ""}>{t}</a></li>' for h, t in NAV_ITEMS)
    devis = '#contact' if home else ('/#contact' if PROD else 'index.html#contact')
    return f'''<nav class="nav{'' if home else ' solid'}" id="nav" aria-label="Navigation principale">
  <div class="wrap">
    <a class="brand" href="{'#top' if home else url('')}"><img src="{A}img/logo.png" alt="" width="30" height="30"><span>Artisan Pisciniste</span></a>
    <ul id="menu-list">{items}</ul>
    <a class="pill pill-brand" href="{devis}">Devis gratuit</a>
    <button class="menu" type="button" aria-expanded="false" aria-controls="menu-list" aria-label="Menu"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h14M3 14h14"/></svg></button>
  </div>
</nav>'''

FOOTER = f'''<footer>
  <div class="wrap">
    <span class="fb"><img src="{A}img/logo.png" alt="" width="36" height="36" loading="lazy">ORPES · Olivier Rousseau · 28 rue des Écoles, 56250 Elven · SIREN 440 790 657</span>
    <span><a href="{url('blog-list')}">Conseils</a> · <a href="{url('terms-and-conditions')}">Mentions légales</a></span>
  </div>
</footer>'''

SITE_JS = r"""(()=>{
/* Mesure d'audience anonyme (sans cookie) : une page vue = un signal vers /stat.php */
try{if(location.protocol==='https:'&&navigator.doNotTrack!=='1'&&navigator.sendBeacon)navigator.sendBeacon('/stat.php',new Blob([JSON.stringify({p:location.pathname,t:document.title,r:document.referrer})],{type:'text/plain'}));}catch(e){}
/* Opening a page from a link always starts at the top (back/forward keeps the reading position) */
(()=>{const nt=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0]||{}).type;
  if(location.hash||nt==='back_forward')return;
  try{history.scrollRestoration='manual';}catch(e){}
  let user=false;['wheel','touchstart','keydown','pointerdown'].forEach(ev=>addEventListener(ev,()=>{user=true;},{once:true,passive:true}));
  const top=()=>{if(user)return;const h=document.documentElement,s=h.style.scrollBehavior;h.style.scrollBehavior='auto';window.scrollTo(0,0);h.style.scrollBehavior=s;};
  top();addEventListener('DOMContentLoaded',top);addEventListener('load',()=>{top();setTimeout(top,60);});addEventListener('pageshow',top);})();
const nav=document.getElementById('nav'),btn=nav&&nav.querySelector('.menu');
if(btn){btn.addEventListener('click',()=>{const o=nav.classList.toggle('open');btn.setAttribute('aria-expanded',o);});
  nav.querySelectorAll('ul a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');btn.setAttribute('aria-expanded','false');}));}
document.documentElement.classList.add('js');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.up').forEach(el=>io.observe(el));
const bar=document.querySelector('.readbar span'),prose=document.querySelector('.prose'),cover=document.querySelector('article .cover img');
if(bar||cover){let tk=false;const f=()=>{tk=false;
  if(bar&&prose){const r=prose.getBoundingClientRect();bar.style.setProperty('--p',Math.min(1,Math.max(0,(innerHeight-r.top)/(r.height+innerHeight*.4))));}
  if(cover&&!reduce){const r=cover.parentElement.getBoundingClientRect();cover.style.setProperty('--py',Math.max(-40,Math.min(40,r.top*-.06)).toFixed(1));}};
  addEventListener('scroll',()=>{if(!tk){tk=true;requestAnimationFrame(f);}},{passive:true});f();}
})();"""
if PROD: open(f'{OUT}/assets/site.js', 'w').write(SITE_JS)

import hashlib
def ver(rel):
    """Numéro de version d'un fichier (empreinte de son contenu) pour forcer la mise à jour du cache navigateur."""
    return hashlib.md5(open(f'{OUT}/assets/{rel}', 'rb').read()).hexdigest()[:8]

def page(path, title, desc, canonical_slug, og_image, body, jsonld, scripts='', home=False, body_class=''):
    canon = DOMAIN + ('/' if canonical_slug == '' else '/' + canonical_slug)
    if PROD:
        css = f'<link rel="preload" href="{A}fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="stylesheet" href="{A}site.css?v={ver('site.css')}">'
        js = f'<script src="{A}site.js?v={ver('site.js')}" defer></script>'
    else:
        css = f'<style>{SITE_CSS}</style>'
        js = f'<script>{SITE_JS}</script>'
    ld = ''.join(f'<script type="application/ld+json">{json.dumps(j, ensure_ascii=False)}</script>\n' for j in jsonld)
    head = f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{canon}">
<meta name="theme-color" content="#050a1f">
<meta property="og:type" content="{'website' if home else 'article'}">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Artisan Pisciniste">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{og_image}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="48x48" href="{A}img/favicon-48.png">
<link rel="apple-touch-icon" href="{A}img/apple-touch-icon.png">
{css}
{ld}</head>
'''
    if not PROD:  # artifact contract
        head = f'<title>{html.escape(title)}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="description" content="{html.escape(desc)}">\n{css}\n'
        if path != 'index.html':  # supporting pages need their own skeleton
            head = '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + head + '</head>\n'
    doc = head + (f'<body class="{body_class}">\n' if (PROD or path != 'index.html') else '') + body + '\n' + js + '\n' + scripts
    if PROD or path != 'index.html': doc += '\n</body>\n</html>\n'
    open(f'{OUT}/{path}', 'w').write(doc)

ORG = {"@type": "HomeAndConstructionBusiness", "@id": DOMAIN + "/#entreprise", "name": "Artisan Pisciniste", "legalName": "ORPES",
       "description": "Artisan pisciniste à Elven : construction, rénovation et installation de piscines coque, béton, liner et membrane armée dans le Morbihan.",
       "url": DOMAIN + "/", "logo": DOMAIN + "/assets/img/logo-512.png", "image": OG['home'], "telephone": "+33652089219",
       "founder": {"@type": "Person", "name": "Olivier Rousseau", "image": DOMAIN + "/assets/img/olivier.webp"},
       "address": {"@type": "PostalAddress", "streetAddress": "28 rue des Écoles", "postalCode": "56250", "addressLocality": "Elven", "addressRegion": "Bretagne", "addressCountry": "FR"},
       "areaServed": {"@type": "AdministrativeArea", "name": "Morbihan"},
       "sameAs": ["https://www.facebook.com/people/Artisan-Pisciniste/61555487587063/"]}

def cover_html(a, cls='cover', eager=False):
    if a['img'] is None:
        return f'''<div class="{cls} art" role="img" aria-label="Illustration : chauffage de l'eau de piscine"><svg viewBox="0 0 560 240" fill="none" aria-hidden="true">
<path d="M20 170c40 0 50-14 90-14s50 14 90 14 50-14 90-14 50 14 90 14 50-14 90-14 50 14 90 14" stroke="#46c9e6" stroke-width="4" stroke-linecap="round"/>
<path d="M20 205c40 0 50-14 90-14s50 14 90 14 50-14 90-14 50 14 90 14 50-14 90-14 50 14 90 14" stroke="#46c9e6" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/>
<circle cx="420" cy="70" r="34" stroke="#f4b400" stroke-width="4"/><path d="M420 18v-12M420 134v-12M368 70h-12M484 70h-12M383 33l-8-8M465 115l-8-8M457 33l8-8M375 115l8-8" stroke="#f4b400" stroke-width="4" stroke-linecap="round"/>
<path d="M150 130c-14-20 14-34 0-56M190 130c-14-20 14-34 0-56M230 130c-14-20 14-34 0-56" stroke="#f3f6ff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round"/></svg></div>'''
    src, w, h = IMG[a['img']]
    return f'<figure class="{cls}"><img src="{src}" alt="{html.escape(COVER_ALT[a["img"]])}" width="{w}" height="{h}"{"" if eager else " loading=\"lazy\""}{" fetchpriority=\"high\"" if eager else ""}></figure>'

def card(a, feature=False):
    meta = f'{frdate(a["date"])} · {a["mins"]} min de lecture' if a['date'] else f'Dossier · {a["mins"]} min de lecture'
    ph = cover_html(a, 'cover')
    return f'''<a class="card{' feature' if feature else ''} up" href="{url(a['slug'])}"><div class="ph">{ph}</div><div style="display:grid;gap:10px"><span class="tag">{a['tag']}</span><h3>{html.escape(a['title'])}</h3><p>{html.escape(a['desc'])}</p><span class="meta">{meta}</span></div></a>'''

# ---------- article pages ----------
for a in articles:
    others = [o for o in articles_sorted if o['slug'] != a['slug']]
    same = [o for o in others if o['tag'] == a['tag']]
    related = (same + [o for o in others if o not in same])[:3]
    when = f'Publié le <time datetime="{a["date"][:10]}">{frdate(a["date"])}</time> · ' if a['date'] else ''
    body = f'''{nav(current='Conseils')}
<div class="readbar" aria-hidden="true"><span></span></div>
<main class="inner-page">
  <article>
    <div class="wrap">
      <ol class="crumbs"><li><a href="{url('')}">Accueil</a></li><li><a href="{url('blog-list')}">Conseils</a></li><li aria-current="page">{a['tag']}</li></ol>
      <header class="art-head">
        <span class="eyebrow">{a['tag']}</span>
        <h1>{html.escape(a['title'])}</h1>
        <div class="byline"><img src="{A}img/olivier-face.webp" alt="" width="44" height="44" style="border-radius:50%"><span><b>{a['author']}</b>, artisan pisciniste à Elven<br>{when}{a['mins']} min de lecture</span></div>
      </header>
      {cover_html(a, 'cover', eager=True)}
      <div class="prose">{a['body']}</div>
      <aside class="cta-box">
        <h2>Un projet de piscine dans le Morbihan ?</h2>
        <p>Un seul interlocuteur du devis au suivi après chantier : Olivier étudie votre terrain, vous remet un devis détaillé gratuit, réalise les travaux et reste votre contact ensuite.</p>
        <div class="row2"><a class="pill pill-brand" href="{'/#contact' if PROD else 'index.html#contact'}">Demander un devis</a><span>06 52 08 92 19</span></div>
      </aside>
    </div>
  </article>
  <section class="band">
    <div class="wrap">
      <div class="head"><span class="eyebrow">À lire aussi</span><h2 class="h-l" style="font-size:clamp(30px,4vw,44px)">Autres conseils</h2></div>
      <div class="cards">{''.join(card(o) for o in related)}</div>
    </div>
  </section>
</main>
{FOOTER}'''
    ld = [{"@context": "https://schema.org", "@type": "BlogPosting", "headline": a['title'][:110], "description": a['desc'],
           "image": a['og'], "author": {"@type": "Person", "name": "Olivier Rousseau"}, "publisher": {"@id": DOMAIN + "/#entreprise"},
           "mainEntityOfPage": DOMAIN + '/' + a['slug'], "inLanguage": "fr-FR", **({"datePublished": a['date'][:10]} if a['date'] else {}), "dateModified": TODAY},
          {"@context": "https://schema.org", **ORG},
          {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": "Accueil", "item": DOMAIN + "/"},
              {"@type": "ListItem", "position": 2, "name": "Conseils", "item": DOMAIN + "/blog-list"},
              {"@type": "ListItem", "position": 3, "name": a['title'][:80], "item": DOMAIN + '/' + a['slug']}]}]
    page(f"{a['slug']}.html", f"{a['seo']} | Artisan Pisciniste", a['desc'], a['slug'], a['og'], body, ld)

# ---------- blog list ----------
feat, rest = articles_sorted[0], articles_sorted[1:]
body = f'''{nav(current='Conseils')}
<main class="inner-page">
  <section class="band" style="padding-top:clamp(40px,6vw,72px)">
    <div class="wrap">
      <div class="head"><span class="eyebrow">Conseils</span><h1 class="h-xl">Le journal du pisciniste.</h1>
      <p class="lede">Construction, équipement, entretien : les conseils d'Olivier Rousseau, artisan pisciniste dans le Morbihan depuis plus de 25 ans.</p></div>
      <div class="cards">{card(feat, True)}{''.join(card(a) for a in rest)}</div>
    </div>
  </section>
</main>
{FOOTER}'''
ld = [{"@context": "https://schema.org", "@type": "Blog", "name": "Le journal du pisciniste", "url": DOMAIN + "/blog-list", "publisher": {"@id": DOMAIN + "/#entreprise"},
       "blogPost": [{"@type": "BlogPosting", "headline": a['title'][:110], "url": DOMAIN + '/' + a['slug']} for a in articles_sorted]},
      {"@context": "https://schema.org", **ORG}]
page('blog-list.html', 'Conseils piscine dans le Morbihan | Artisan Pisciniste',
     "Construction, chauffage, filtration, hivernage : les conseils d'un artisan pisciniste du Morbihan pour bien choisir et entretenir votre piscine.",
     'blog-list', OG['home'], body, ld)

# ---------- legal ----------
legal = clean(PAGES['terms-and-conditions']['items'][0][1])
legal = re.sub(r'^\s*<h2>MENTIONS LÉGALES\s*</h2>', '', legal)
legal += f'''<h2>Données personnelles</h2><p>Les informations envoyées par le formulaire de contact (nom, téléphone, e-mail, commune, message) servent uniquement à répondre à votre demande de devis. Elles ne sont ni cédées ni utilisées à d'autres fins, et sont conservées au plus trois ans après le dernier contact. Vous pouvez demander leur consultation, rectification ou suppression en écrivant à ORPES, 28 rue des Écoles, 56250 Elven, ou par téléphone au 06 52 08 92 19. Vous pouvez aussi adresser une réclamation à la CNIL.</p><h2>Cookies et mesure d'audience</h2><p>Ce site ne dépose aucun cookie de mesure d'audience ni de publicité. Une mesure d'audience anonyme, hébergée sur notre propre serveur, compte les pages vues et la provenance des visites (moteur de recherche, réseau social, accès direct). Elle n'utilise pas de cookie, ne conserve pas votre adresse IP et ne permet pas de vous identifier ; ses données sont conservées 13 mois. Elle est désactivée si votre navigateur envoie le signal « Ne pas me pister ».</p>'''
body = f'''{nav()}
<main class="inner-page"><section class="band" style="padding-top:clamp(40px,6vw,72px)"><div class="wrap legal">
<ol class="crumbs" style="padding-top:0;margin-bottom:24px"><li><a href="{url('')}">Accueil</a></li><li aria-current="page">Mentions légales</li></ol>
<h1 class="h-l">Mentions légales</h1><div class="prose" style="margin-left:0">{legal}</div></div></section></main>
{FOOTER}'''
page('terms-and-conditions.html', 'Mentions légales | Artisan Pisciniste', "Mentions légales du site artisan-pisciniste.fr : éditeur ORPES, Olivier Rousseau, Elven (56). Hébergement, propriété intellectuelle, données personnelles.",
     'terms-and-conditions', OG['home'], body, [])

# ---------- 404 ----------
body = f'''{nav()}
<main class="inner-page e404"><div class="wrap"><span class="eyebrow">Erreur 404</span><h1 class="h-l" style="margin:14px 0 18px">Cette page a pris le large.</h1>
<p class="lede" style="margin:0 auto 28px">Elle a peut-être changé d'adresse. Les conseils et les réalisations sont toujours là.</p>
<div class="ctas"><a class="pill pill-brand" href="{url('')}">Retour à l'accueil</a><a class="pill pill-ink" href="{url('blog-list')}">Voir les conseils</a></div></div></main>
{FOOTER}'''
if PROD:
    page('404.html', 'Page introuvable | Artisan Pisciniste', 'Cette page est introuvable.', '', OG['home'], body, [])
    # 404 must not be indexed
    t = open(f'{OUT}/404.html').read().replace('<meta name="theme-color"', '<meta name="robots" content="noindex">\n<meta name="theme-color"', 1)
    open(f'{OUT}/404.html', 'w').write(t)

# ---------- home ----------
hbody = TPL.split('</style>', 1)[1].split('<script src="https://cdnjs', 1)[0]
hjs = TPL.rsplit('<script>', 1)[1].rsplit('</script>', 1)[0]
hbody = re.sub(r'<nav class="nav".*?</nav>', lambda m: nav(home=True).replace('class="nav solid"', 'class="nav"'), hbody, flags=re.S)
hbody = re.sub(r'<footer>.*?</footer>', lambda m: FOOTER, hbody, flags=re.S)
def imgtag(k, alt_attr_src):
    return IMG[k][0]
for k in ['hero', 'rect', 'mini', 'stone', 'tanna', 'olivier']:
    hbody = hbody.replace('{{' + k + '}}', IMG[k][0])
hbody = hbody.replace('{{logo}}', f'{A}img/logo.png').replace('{{qr}}', f'{A}img/qr.png')
hbody = hbody.replace('<img class="hero-img" src="' + IMG['hero'][0] + '" alt="">',
                      f'<img class="hero-img" src="{IMG["hero"][0]}" alt="" width="{IMG["hero"][1]}" height="{IMG["hero"][2]}" fetchpriority="high">')
hbody = hbody.replace('<img class="badge" src=', '<img class="badge" width="104" height="104" src=')
# lazy-load everything below the fold
hbody = re.sub(r'<img (?!class="hero-img")(?!class="badge")(?![^>]*loading=)', '<img loading="lazy" ', hbody)
hbody = hbody.replace('href="https://artisan-pisciniste.fr/les-avantages-des-minipiscines-de-moins-de-10-m-dans-le-morbihan-"',
                      f'href="{url("les-avantages-des-minipiscines-de-moins-de-10-m-dans-le-morbihan-")}"')
# journal -> real internal cards
journal = f'''<section class="band" id="journal">
  <div class="wrap">
    <div class="head up"><span class="eyebrow">Conseils</span><h2 class="h-l">Le journal du pisciniste.</h2></div>
    <div class="cards">{''.join(card(a) for a in articles_sorted[:3])}</div>
    <p style="margin-top:36px"><a class="more" href="{url('blog-list')}">Tous les conseils ({len(articles)} articles)</a></p>
  </div>
</section>'''
hbody = re.sub(r'<section class="band" id="journal">.*?</section>', lambda m: journal, hbody, flags=re.S)
hbody = hbody.replace('<section class="gal" id="gal">', suppliers_html() + '<section class="gal" id="gal">', 1)
assert 'id="fournisseurs"' in hbody
hjs = hjs + SUP_JS
# real form
hbody = hbody.replace('<form id="devis" novalidate>', f'<form id="devis" method="post" action="{"/contact.php" if PROD else "#contact"}" novalidate>')
hbody = hbody.replace('<button class="pill pill-brand" type="submit">Envoyer ma demande</button>',
    '<div class="hp" aria-hidden="true"><label for="f-site">Site web<input id="f-site" name="site" tabindex="-1" autocomplete="off"></label></div>'
    f'<p class="consent">Vos informations servent uniquement à répondre à votre demande. <a href="{url("terms-and-conditions")}">En savoir plus</a>.</p>'
    '<button class="pill pill-brand" type="submit">Envoyer ma demande</button>')
assert '{{' not in hbody, re.findall(r'\{\{\w+\}\}', hbody)
old_submit = hjs[hjs.index("$('devis').addEventListener('submit'"):hjs.index('})();', hjs.index("$('devis').addEventListener('submit'"))]
new_submit = r"""$('devis').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,out=$('sent'),btn=f.querySelector('[type=submit]');out.hidden=false;
  const rules={nom:v=>v.length>=2||'Indiquez votre nom et prénom.',
    tel:v=>v.replace(/\D/g,'').length>=10||'Indiquez un numéro de téléphone complet (10 chiffres).',
    email:v=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)||'Indiquez une adresse e-mail valide.',
    commune:v=>v.length>=2||'Indiquez la commune du chantier.',
    message:v=>v.length>=5||'Décrivez votre projet en quelques mots.'};
  let first=null;
  for(const k in rules){const el=f.elements[k],r=rules[k](el.value.trim()),ok=r===true;
    el.setAttribute('aria-invalid',ok?'false':'true');$('e-'+k).textContent=ok?'':r;if(!ok&&!first)first=el;}
  if(first){out.textContent='Merci de compléter les champs signalés en rouge.';first.focus();return;}
  """ + ("""btn.disabled=true;out.textContent='Envoi en cours…';
  try{const r=await fetch(f.action,{method:'POST',body:new FormData(f),headers:{'Accept':'application/json'}});const j=await r.json();
    if(j.ok){f.reset();out.textContent='Merci, votre demande est bien partie. Olivier vous rappelle rapidement.';}
    else out.textContent=j.error||"L'envoi a échoué. Appelez directement le 06 52 08 92 19.";}
  catch(err){out.textContent="L'envoi a échoué. Appelez directement le 06 52 08 92 19.";}
  btn.disabled=false;""" if PROD else """out.textContent='Aperçu : sur le site en ligne, votre demande « '+f.type.value+' » partira par e-mail chez Olivier. Rien n\\'a été envoyé ici.';""") + """
});
"""
hjs = hjs.replace(old_submit, new_submit)
hjs += r"""
/* ===== Form: clear a field's error while typing ===== */
document.querySelectorAll('#devis [aria-describedby]').forEach(el=>el.addEventListener('input',()=>{if(el.getAttribute('aria-invalid')==='true'){el.setAttribute('aria-invalid','false');const e=document.getElementById(el.getAttribute('aria-describedby'));if(e)e.textContent='';}}));
"""
hjs = hjs.replace("document.documentElement.classList.add('js');", '')
# old .up observer duplicated in site.js: remove from home script
hjs = hjs.replace("const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px'});\ndocument.querySelectorAll('.up').forEach(el=>io.observe(el));", '')
three = f'<script src="{A}vendor/three.min.js" defer></script>' if PROD else '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
if PROD:
    open(f'{OUT}/assets/home.js', 'w').write('(()=>{' + hjs + '})();' if False else hjs)
    scripts = three + f'\n<script src="{A}home.js?v={ver('home.js')}" defer></script>'
else:
    scripts = three + '\n<script>' + hjs + '</script>'
REVIEW_LD = []  # no aggregateRating: Google ignores self-hosted reviews for a LocalBusiness about itself
page('index.html', 'Artisan pisciniste dans le Morbihan, à Elven | Olivier Rousseau',
     "Artisan pisciniste à Elven depuis 25 ans, Olivier Rousseau est votre seul interlocuteur, du devis à la mise en eau : coque, béton, liner, mini piscine dans le Morbihan.",
     '', OG['home'], hbody, [{"@context": "https://schema.org", **ORG}, {"@context": "https://schema.org", "@type": "WebSite", "name": "Artisan Pisciniste", "url": DOMAIN + "/"}],
     scripts=scripts, home=True)

# ---------- server files (prod only) ----------
if PROD:
    urls = [('', '1.0')] + [('blog-list', '0.8')] + [(a['slug'], '0.7') for a in articles_sorted] + [('terms-and-conditions', '0.2')]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
        f'  <url><loc>{DOMAIN}/{s}</loc><lastmod>{TODAY}</lastmod><priority>{p}</priority></url>\n' for s, p in urls) + '</urlset>\n'
    open(f'{OUT}/sitemap.xml', 'w').write(sm)
    open(f'{OUT}/robots.txt', 'w').write(f'User-agent: *\nDisallow: /contact.php\nDisallow: /stat.php\nDisallow: /admin/\n\nSitemap: {DOMAIN}/sitemap.xml\n')
    shutil.copy(f'{S}/server/.htaccess', f'{OUT}/.htaccess')
    shutil.copy(f'{S}/server/contact.php', f'{OUT}/contact.php')
    shutil.copy(f'{S}/server/mail-template.php', f'{OUT}/mail-template.php')
    shutil.copy(f'{S}/server/crm-db.php', f'{OUT}/crm-db.php')
    shutil.copy(f'{S}/server/stat.php', f'{OUT}/stat.php')
    shutil.copy(f'{S}/server/google22bfa898030c3548.html', f'{OUT}/google22bfa898030c3548.html')
    shutil.copytree(f'{S}/server/admin', f'{OUT}/admin')
    shutil.copy(f'{S}/server/contact-config.php', f'{OUT}/contact-config.php')
    shutil.copy(f'{S}/server/logo-mail.png', f'{OUT}/assets/img/logo-mail.png')
    shutil.copy(f'{S}/server/contact-config.exemple.php', f'{OUT}/contact-config.exemple.php')
print('built', MODE, OUT, len(articles), 'articles')
