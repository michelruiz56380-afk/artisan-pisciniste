<?php
/* Mini CRM — Artisan Pisciniste
 * /admin/            liste des demandes + compteurs
 * /admin/?id=12      fiche d'une demande
 * /admin/?new=1      ajouter une demande à la main
 * /admin/?export=1   export CSV (Excel)
 * Mot de passe oublié : voir le README du dépôt. */
declare(strict_types=1);
require dirname(__DIR__) . '/crm-db.php';

date_default_timezone_set('Europe/Paris');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

$https = ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off';
session_name('ap_crm');
session_set_cookie_params(['lifetime' => 0, 'path' => '/admin/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_HTML5, 'UTF-8'); }
function csrf(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(16)); }
function check_csrf(): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_POST['csrf'] ?? ''))) { http_response_code(400); exit('Session expirée. Rechargez la page.'); }
}
function go(string $q = ''): never { header('Location: ./' . $q, true, 303); exit; }
function flash(?string $m = null): ?string {
    if ($m !== null) { $_SESSION['flash'] = $m; return null; }
    $f = $_SESSION['flash'] ?? null; unset($_SESSION['flash']); return $f;
}
function fr_date(?string $dt, bool $time = true): string {
    if (!$dt) return '';
    $d = new DateTimeImmutable($dt);
    $m = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    return $d->format('j') . ' ' . $m[(int)$d->format('n') - 1] . ' ' . $d->format('Y') . ($time ? ' · ' . $d->format('H\hi') : '');
}
function euros(?float $v): string { return $v === null ? '' : number_format($v, 0, ',', "\u{202F}") . "\u{202F}€"; }
function tel_href(string $t): string {
    $t = preg_replace('/[^\d+]/', '', $t) ?? '';
    return str_starts_with($t, '0') ? '+33' . substr($t, 1) : $t;
}

try { $db = crm_db(); } catch (Throwable $e) {
    http_response_code(500);
    exit('Base de données indisponible : ' . h($e->getMessage()) . '. Vérifiez que l\'extension PHP pdo_sqlite est activée (hPanel › Avancé › Configuration PHP).');
}

/* ---------- authentification ---------- */
$hash = crm_setting('password_hash');
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$error = null;

if (isset($_GET['logout'])) { $_SESSION = []; session_destroy(); go(); }

if (!$hash && ($_POST['action'] ?? '') === 'setup') {
    check_csrf();
    $p1 = (string)($_POST['p1'] ?? ''); $p2 = (string)($_POST['p2'] ?? '');
    if (mb_strlen($p1) < 10) $error = 'Choisissez un mot de passe d\'au moins 10 caractères.';
    elseif ($p1 !== $p2) $error = 'Les deux mots de passe ne sont pas identiques.';
    else {
        crm_setting('password_hash', password_hash($p1, PASSWORD_DEFAULT));
        session_regenerate_id(true); $_SESSION['ok'] = true; flash('Mot de passe créé. Bienvenue dans le CRM.'); go();
    }
}
if ($hash && ($_POST['action'] ?? '') === 'login') {
    check_csrf();
    $db->prepare('DELETE FROM tentatives WHERE at < ?')->execute([time() - 900]);
    $n = $db->prepare('SELECT COUNT(*) FROM tentatives WHERE ip = ?'); $n->execute([$ip]);
    if ((int)$n->fetchColumn() >= 5) $error = 'Trop d\'essais. Réessayez dans 15 minutes.';
    elseif (password_verify((string)($_POST['p'] ?? ''), $hash)) {
        $db->prepare('DELETE FROM tentatives WHERE ip = ?')->execute([$ip]);
        session_regenerate_id(true); $_SESSION['ok'] = true; go();
    } else {
        $db->prepare('INSERT INTO tentatives (ip, at) VALUES (?, ?)')->execute([$ip, time()]);
        usleep(400000);
        $error = 'Mot de passe incorrect.';
    }
}

if (empty($_SESSION['ok'])) { page_auth(!$hash, $error); exit; }

/* ---------- actions ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    $a = (string)($_POST['action'] ?? '');
    $id = (int)($_POST['id'] ?? 0);
    $f = fn(string $k, int $max = 300) => trim(mb_substr(str_replace("\0", '', (string)($_POST[$k] ?? '')), 0, $max));

    if ($a === 'create') {
        if ($f('nom') === '') { flash('Le nom est obligatoire.'); go('?new=1'); }
        $id = crm_add(['nom' => $f('nom', 120), 'tel' => $f('tel', 40), 'email' => $f('email', 160), 'commune' => $f('commune', 120),
                       'type' => $f('type', 60), 'message' => $f('message', 5000)], 'manuel');
        flash('Demande ajoutée.'); go('?id=' . $id);
    }
    $d = $id ? crm_get($id) : null;
    if (!$d) go();

    if ($a === 'save') {
        $statut = array_key_exists($_POST['statut'] ?? '', CRM_STATUTS) ? $_POST['statut'] : $d['statut'];
        $mt = str_replace([' ', "\u{202F}", "\u{00A0}", '€'], '', $f('montant', 20)); $mt = str_replace(',', '.', $mt);
        $montant = $mt === '' ? null : (is_numeric($mt) ? (float)$mt : $d['montant']);
        $relance = preg_match('/^\d{4}-\d{2}-\d{2}$/', $f('relance', 10)) ? $f('relance', 10) : null;
        crm_db()->prepare('UPDATE demandes SET nom=?, tel=?, email=?, commune=?, type=?, message=?, statut=?, montant=?, relance=?, updated_at=? WHERE id=?')
            ->execute([$f('nom', 120), $f('tel', 40), $f('email', 160), $f('commune', 120), $f('type', 60), $f('message', 5000), $statut, $montant, $relance, crm_now(), $id]);
        if ($statut !== $d['statut']) crm_note($id, 'Statut : ' . CRM_STATUTS[$d['statut']] . ' → ' . CRM_STATUTS[$statut], true);
        if ($montant !== null && (float)$montant !== (float)($d['montant'] ?? -1)) crm_note($id, 'Montant du devis : ' . euros($montant), true);
        if ($f('note', 4000) !== '') crm_note($id, $f('note', 4000));
        flash('Enregistré.'); go('?id=' . $id);
    }
    if ($a === 'note' && $f('note', 4000) !== '') {
        crm_note($id, $f('note', 4000));
        crm_db()->prepare('UPDATE demandes SET updated_at=? WHERE id=?')->execute([crm_now(), $id]);
        go('?id=' . $id . '#notes');
    }
    if ($a === 'delete' && ($_POST['confirm'] ?? '') === 'oui') {
        crm_db()->prepare('DELETE FROM notes WHERE demande_id=?')->execute([$id]);
        crm_db()->prepare('DELETE FROM demandes WHERE id=?')->execute([$id]);
        flash('Demande supprimée définitivement.'); go();
    }
    go('?id=' . $id);
}

/* ---------- export CSV ---------- */
if (isset($_GET['export'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="demandes-devis-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Référence', 'Reçue le', 'Source', 'Client', 'Téléphone', 'E-mail', 'Commune', 'Projet', 'Statut', 'Montant devis (€)', 'Relance', 'Message'], ';');
    foreach ($db->query('SELECT * FROM demandes ORDER BY created_at DESC') as $r)
        fputcsv($out, [$r['ref'], $r['created_at'], $r['source'], $r['nom'], $r['tel'], $r['email'], $r['commune'], $r['type'],
                       CRM_STATUTS[$r['statut']] ?? $r['statut'], $r['montant'] === null ? '' : str_replace('.', ',', (string)$r['montant']), $r['relance'], $r['message']], ';');
    exit;
}

/* ---------- pages ---------- */
if (isset($_GET['new'])) { page_form(null); exit; }
if (isset($_GET['id'])) { $d = crm_get((int)$_GET['id']); $d ? page_form($d) : go(); exit; }
page_list();

/* ================================================================== */

function layout(string $title, string $body): void { ?>
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title><?= h($title) ?> · CRM Artisan Pisciniste</title>
<link rel="icon" href="/assets/img/favicon-48.png"><link rel="stylesheet" href="admin.css?v=1"></head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="./"><img src="/assets/img/logo.png" alt="" width="30" height="30"><span>CRM <b>Artisan Pisciniste</b></span></a>
  <?php if (!empty($_SESSION['ok'])): ?><nav><a href="./?new=1" class="btn btn-brand">+ Nouvelle demande</a><a href="./?logout=1" class="link">Se déconnecter</a></nav><?php endif; ?>
</div></header>
<main class="wrap"><?php if ($m = flash()): ?><p class="flash"><?= h($m) ?></p><?php endif; ?><?= $body ?></main>
</body></html>
<?php }

function page_auth(bool $setup, ?string $error): void {
    ob_start(); ?>
    <section class="auth card">
      <img src="/assets/img/logo.png" alt="" width="64" height="64">
      <?php if ($setup): ?>
        <h1>Créer le mot de passe du CRM</h1>
        <p class="muted">Première connexion : choisissez le mot de passe qui protégera les demandes de devis. Au moins 10 caractères.</p>
        <form method="post"><input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="setup">
          <label>Mot de passe<input type="password" name="p1" autocomplete="new-password" required minlength="10" autofocus></label>
          <label>Confirmer le mot de passe<input type="password" name="p2" autocomplete="new-password" required minlength="10"></label>
          <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
          <button class="btn btn-brand">Créer et entrer</button></form>
      <?php else: ?>
        <h1>CRM Artisan Pisciniste</h1>
        <p class="muted">Espace réservé. Entrez le mot de passe.</p>
        <form method="post"><input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="login">
          <label>Mot de passe<input type="password" name="p" autocomplete="current-password" required autofocus></label>
          <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
          <button class="btn btn-brand">Se connecter</button></form>
      <?php endif; ?>
    </section>
    <?php layout('Connexion', (string)ob_get_clean());
}

function badge(string $s): string { return '<span class="badge s-' . h($s) . '">' . h(CRM_STATUTS[$s] ?? $s) . '</span>'; }

function page_list(): void {
    $db = crm_db();
    $all = $db->query('SELECT statut, COUNT(*) n, COALESCE(SUM(montant),0) m FROM demandes GROUP BY statut')->fetchAll();
    $c = array_fill_keys(array_keys(CRM_STATUTS), 0); $ca = 0.0; $total = 0;
    foreach ($all as $r) { $c[$r['statut']] = (int)$r['n']; $total += (int)$r['n']; if ($r['statut'] === 'gagnee') $ca = (float)$r['m']; }
    $mois = (int)$db->query("SELECT COUNT(*) FROM demandes WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')")->fetchColumn();
    $closed = $c['gagnee'] + $c['perdue'];
    $taux = $closed ? round($c['gagnee'] / $closed * 100) : null;
    $relances = (int)$db->query("SELECT COUNT(*) FROM demandes WHERE relance IS NOT NULL AND relance <= date('now','localtime') AND statut NOT IN ('gagnee','perdue')")->fetchColumn();

    $filtre = array_key_exists($_GET['statut'] ?? '', CRM_STATUTS) ? $_GET['statut'] : (($_GET['statut'] ?? '') === 'relance' ? 'relance' : '');
    $q = trim((string)($_GET['q'] ?? ''));
    $sql = 'SELECT * FROM demandes WHERE 1'; $args = [];
    if ($filtre === 'relance') $sql .= " AND relance IS NOT NULL AND relance <= date('now','localtime') AND statut NOT IN ('gagnee','perdue')";
    elseif ($filtre !== '') { $sql .= ' AND statut = ?'; $args[] = $filtre; }
    if ($q !== '') { $sql .= ' AND (nom LIKE ? OR commune LIKE ? OR email LIKE ? OR tel LIKE ? OR ref LIKE ? OR message LIKE ?)'; array_push($args, ...array_fill(0, 6, '%' . $q . '%')); }
    $sql .= ' ORDER BY created_at DESC LIMIT 500';
    $st = $db->prepare($sql); $st->execute($args); $rows = $st->fetchAll();
    $qs = fn(array $p) => './?' . http_build_query(array_filter($p + ['q' => $q], fn($v) => $v !== ''));

    ob_start(); ?>
    <section class="kpis">
      <div class="kpi"><span>Demandes reçues</span><b><?= $total ?></b><small><?= $mois ?> ce mois-ci</small></div>
      <a class="kpi <?= $c['nouvelle'] ? 'hot' : '' ?>" href="<?= h($qs(['statut' => 'nouvelle'])) ?>"><span>À traiter</span><b><?= $c['nouvelle'] ?></b><small>nouvelles demandes</small></a>
      <a class="kpi" href="<?= h($qs(['statut' => 'devis'])) ?>"><span>En cours</span><b><?= $c['en_cours'] + $c['devis'] ?></b><small><?= $c['devis'] ?> devis envoyé<?= $c['devis'] > 1 ? 's' : '' ?></small></a>
      <a class="kpi win" href="<?= h($qs(['statut' => 'gagnee'])) ?>"><span>Gagnées</span><b><?= $c['gagnee'] ?></b><small><?= $ca > 0 ? h(euros($ca)) . ' signés' : 'chantiers signés' ?></small></a>
      <div class="kpi"><span>Taux de transformation</span><b><?= $taux === null ? '–' : $taux . '&nbsp;%' ?></b><small><?= $c['perdue'] ?> perdue<?= $c['perdue'] > 1 ? 's' : '' ?></small></div>
    </section>

    <section class="toolbar">
      <nav class="seg">
        <a href="<?= h($qs([])) ?>" class="<?= $filtre === '' ? 'on' : '' ?>">Toutes <i><?= $total ?></i></a>
        <?php foreach (CRM_STATUTS as $k => $l): ?><a href="<?= h($qs(['statut' => $k])) ?>" class="<?= $filtre === $k ? 'on' : '' ?>"><?= h($l) ?> <i><?= $c[$k] ?></i></a><?php endforeach; ?>
        <?php if ($relances): ?><a href="<?= h($qs(['statut' => 'relance'])) ?>" class="<?= $filtre === 'relance' ? 'on' : '' ?> warn">À relancer <i><?= $relances ?></i></a><?php endif; ?>
      </nav>
      <form class="search" method="get"><?php if ($filtre): ?><input type="hidden" name="statut" value="<?= h($filtre) ?>"><?php endif; ?>
        <input type="search" name="q" value="<?= h($q) ?>" placeholder="Rechercher un nom, une commune, un téléphone…" aria-label="Rechercher"></form>
      <a class="link" href="./?export=1">Exporter (Excel)</a>
    </section>

    <?php if (!$rows): ?>
      <div class="empty card"><b><?= $total ? 'Aucune demande ne correspond.' : 'Aucune demande pour l\'instant.' ?></b>
        <p class="muted"><?= $total ? 'Changez de filtre ou de recherche.' : 'Les demandes envoyées par le formulaire du site arriveront ici automatiquement. Vous pouvez aussi en ajouter une reçue par téléphone.' ?></p></div>
    <?php else: ?>
    <div class="table card"><table>
      <thead><tr><th>Reçue le</th><th>Client</th><th>Commune</th><th>Projet</th><th>Statut</th><th class="num">Devis</th></tr></thead>
      <tbody>
      <?php foreach ($rows as $r): $late = $r['relance'] && $r['relance'] <= date('Y-m-d') && !in_array($r['statut'], ['gagnee', 'perdue'], true); ?>
        <tr onclick="location.href='./?id=<?= (int)$r['id'] ?>'">
          <td data-l="Reçue le"><?= h(fr_date($r['created_at'])) ?><?php if ($r['source'] === 'manuel'): ?> <span class="tag">ajoutée</span><?php endif; ?></td>
          <td data-l="Client"><a href="./?id=<?= (int)$r['id'] ?>"><b><?= h($r['nom']) ?></b></a><small><?= h($r['tel']) ?></small></td>
          <td data-l="Commune"><?= h($r['commune']) ?></td>
          <td data-l="Projet"><?= h($r['type']) ?></td>
          <td data-l="Statut"><?= badge($r['statut']) ?><?php if ($late): ?> <span class="tag warn">à relancer</span><?php endif; ?></td>
          <td data-l="Devis" class="num"><?= h(euros($r['montant'] === null ? null : (float)$r['montant'])) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody></table></div>
    <?php endif;
    layout('Demandes', (string)ob_get_clean());
}

function page_form(?array $d): void {
    $isNew = $d === null;
    $d ??= ['id' => 0, 'ref' => '', 'nom' => '', 'tel' => '', 'email' => '', 'commune' => '', 'type' => 'Piscine neuve', 'message' => '',
            'statut' => 'nouvelle', 'montant' => null, 'relance' => null, 'created_at' => null, 'source' => 'manuel', 'page' => ''];
    $notes = [];
    if (!$isNew) { $st = crm_db()->prepare('SELECT * FROM notes WHERE demande_id = ? ORDER BY at DESC, id DESC'); $st->execute([$d['id']]); $notes = $st->fetchAll(); }
    $types = CRM_TYPES; if ($d['type'] !== '' && !in_array($d['type'], $types, true)) array_unshift($types, $d['type']);
    $mailto = 'mailto:' . rawurlencode($d['email']) . '?subject=' . rawurlencode('Votre demande de devis piscine' . ($d['ref'] ? ' (' . $d['ref'] . ')' : ''));
    ob_start(); ?>
    <p class="back"><a class="link" href="./">← Toutes les demandes</a></p>
    <?php if ($isNew): ?>
      <h1>Nouvelle demande</h1><p class="muted">Pour une demande reçue par téléphone, sur un salon ou de bouche-à-oreille.</p>
    <?php else: ?>
      <div class="head">
        <div><h1><?= h($d['nom']) ?></h1>
          <p class="muted"><?= badge($d['statut']) ?> Réf. <code><?= h($d['ref']) ?></code> · reçue le <?= h(fr_date($d['created_at'])) ?> · <?= $d['source'] === 'site' ? 'formulaire du site' : 'ajoutée à la main' ?></p></div>
        <div class="actions">
          <?php if ($d['tel']): ?><a class="btn btn-brand" href="tel:<?= h(tel_href($d['tel'])) ?>">Appeler</a><?php endif; ?>
          <?php if ($d['email']): ?><a class="btn" href="<?= h($mailto) ?>">Écrire</a><?php endif; ?>
        </div>
      </div>
    <?php endif; ?>

    <form method="post" class="grid">
      <input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="<?= $isNew ? 'create' : 'save' ?>"><input type="hidden" name="id" value="<?= (int)$d['id'] ?>">
      <section class="card">
        <h2>Client et projet</h2>
        <div class="fields">
          <label>Nom et prénom<input name="nom" value="<?= h($d['nom']) ?>" required></label>
          <label>Téléphone<input name="tel" type="tel" value="<?= h($d['tel']) ?>"></label>
          <label>E-mail<input name="email" type="email" value="<?= h($d['email']) ?>"></label>
          <label>Commune du chantier<input name="commune" value="<?= h($d['commune']) ?>"></label>
          <label class="full">Type de projet<select name="type"><?php foreach ($types as $t): ?><option<?= $t === $d['type'] ? ' selected' : '' ?>><?= h($t) ?></option><?php endforeach; ?></select></label>
          <label class="full">Message du client<textarea name="message" rows="5"><?= h($d['message']) ?></textarea></label>
        </div>
      </section>
      <?php if (!$isNew): ?>
      <section class="card">
        <h2>Suivi</h2>
        <div class="fields">
          <fieldset class="full statuts"><legend>Statut</legend>
            <?php foreach (CRM_STATUTS as $k => $l): ?><label class="st s-<?= h($k) ?>"><input type="radio" name="statut" value="<?= h($k) ?>"<?= $d['statut'] === $k ? ' checked' : '' ?>><span><?= h($l) ?></span></label><?php endforeach; ?>
          </fieldset>
          <label>Montant du devis (€ TTC)<input name="montant" inputmode="decimal" value="<?= $d['montant'] === null ? '' : h(rtrim(rtrim(number_format((float)$d['montant'], 2, ',', ''), '0'), ',')) ?>" placeholder="ex. 9950"></label>
          <label>À relancer le<input name="relance" type="date" value="<?= h($d['relance']) ?>"></label>
          <label class="full">Ajouter une note<textarea name="note" rows="3" placeholder="Appel du 12/11 : visite prévue samedi…"></textarea></label>
        </div>
      </section>
      <?php endif; ?>
      <div class="savebar full"><button class="btn btn-brand"><?= $isNew ? 'Ajouter la demande' : 'Enregistrer' ?></button></div>
    </form>

    <?php if (!$isNew): ?>
    <section class="card" id="notes">
      <h2>Historique et notes</h2>
      <form method="post" class="addnote"><input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="note"><input type="hidden" name="id" value="<?= (int)$d['id'] ?>">
        <input name="note" placeholder="Note rapide (appel, visite, relance…)" aria-label="Note rapide"><button class="btn">Ajouter</button></form>
      <ol class="timeline"><?php foreach ($notes as $n): ?>
        <li class="<?= $n['auto'] ? 'auto' : '' ?>"><time><?= h(fr_date($n['at'])) ?></time><p><?= nl2br(h($n['texte'])) ?></p></li>
      <?php endforeach; ?></ol>
    </section>
    <details class="danger card"><summary>Supprimer cette demande</summary>
      <form method="post"><input type="hidden" name="csrf" value="<?= h(csrf()) ?>"><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$d['id'] ?>">
        <p class="muted">Suppression définitive de la demande et de ses notes, par exemple si le client le demande (RGPD). Pour une affaire non conclue, préférez le statut « Perdue » : elle restera dans les statistiques.</p>
        <label class="check"><input type="checkbox" name="confirm" value="oui" required> Je confirme la suppression définitive</label>
        <button class="btn btn-danger">Supprimer</button></form>
    </details>
    <?php endif;
    layout($isNew ? 'Nouvelle demande' : $d['nom'], (string)ob_get_clean());
}
