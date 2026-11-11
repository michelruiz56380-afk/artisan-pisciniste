<?php
/* DevisVoice — module devis du CRM Artisan Pisciniste
 * /admin/devis.php                 l'application (dictée, devis, catalogue, entreprise)
 * /admin/devis.php?demande=12      nouveau devis pré-rempli depuis une demande du CRM
 * /admin/devis.php?api=…           échanges JSON avec la page (réservés à l'admin connecté)
 * Même mot de passe et même session que le CRM. */
declare(strict_types=1);
require dirname(__DIR__) . '/devis-db.php';

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
function out(int $code, array $data): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$api = $_GET['api'] ?? null;
if (empty($_SESSION['ok'])) {
    if ($api !== null) out(401, ['error' => 'Session expirée : reconnectez-vous.']);
    header('Location: ./', true, 303); exit;
}
$csrf = $_SESSION['csrf'] ??= bin2hex(random_bytes(16));

try { devis_db(); } catch (Throwable $e) {
    if ($api !== null) out(500, ['error' => 'Base de données indisponible.']);
    http_response_code(500); exit('Base de données indisponible : ' . h($e->getMessage()));
}

/* ---------- API JSON ---------- */
if ($api !== null) {
    if ($api === 'state') {
        $key = crm_setting('anthropic_key');
        $demandes = crm_db()->query('SELECT id, ref, nom, tel, email, commune, type, statut, message FROM demandes ORDER BY created_at DESC LIMIT 1000')->fetchAll();
        out(200, [
            'catalog' => devis_json_setting('catalogue', null),
            'company' => devis_json_setting('entreprise', []) + devis_company_default(),
            'keyHint' => $key ? substr($key, -4) : '',
            'quotes' => devis_list(),
            'demandes' => array_map(fn($d) => ['id' => (int)$d['id']] + $d, $demandes),
        ]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'Méthode non autorisée.']);
    if (!hash_equals($csrf, (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) out(400, ['error' => 'Session expirée. Rechargez la page.']);
    $raw = file_get_contents('php://input', false, null, 0, 3 * 1024 * 1024);
    $in = json_decode((string)$raw, true);
    if (!is_array($in)) out(400, ['error' => 'Requête illisible.']);

    try {
        switch ($api) {
            case 'save':
                out(200, ['quote' => devis_save(is_array($in['quote'] ?? null) ? $in['quote'] : [])]);
            case 'delete':
                devis_delete((int)($in['id'] ?? 0)); out(200, ['ok' => true]);
            case 'analyze':
                [$code, $res] = devis_analyze((string)($in['transcript'] ?? '')); out($code, $res);
            case 'catalog':
                $c = $in['data'] ?? null;
                if (!is_array($c) || !is_array($c['products'] ?? null) || !is_array($c['categories'] ?? null)) out(400, ['error' => 'Fichier catalogue non reconnu (il faut des « categories » et des « products »).']);
                $json = json_encode(['categories' => array_values($c['categories']), 'products' => array_values($c['products']), 'updatedAt' => crm_now()], JSON_UNESCAPED_UNICODE);
                if (strlen($json) > 2 * 1024 * 1024) out(400, ['error' => 'Catalogue trop volumineux.']);
                crm_setting('catalogue', $json); out(200, ['ok' => true]);
            case 'company':
                $c = is_array($in['data'] ?? null) ? $in['data'] : [];
                $keep = array_intersect_key($c, devis_company_default());
                if (isset($keep['logo']) && strlen((string)$keep['logo']) > 600000) out(400, ['error' => 'Logo trop lourd : choisissez une image plus petite.']);
                crm_setting('entreprise', json_encode($keep, JSON_UNESCAPED_UNICODE)); out(200, ['ok' => true]);
            case 'key':
                $k = trim((string)($in['key'] ?? ''));
                if ($k === '') { crm_db()->prepare('DELETE FROM reglages WHERE k = ?')->execute(['anthropic_key']); out(200, ['keyHint' => '']); }
                if (!preg_match('/^sk-ant-[A-Za-z0-9_\-]{20,}$/', $k)) out(400, ['error' => 'Ce n\'est pas une clé API Claude (elle commence par sk-ant-).']);
                crm_setting('anthropic_key', $k); out(200, ['keyHint' => substr($k, -4)]);
        }
    } catch (InvalidArgumentException $e) { out(400, ['error' => $e->getMessage()]); }
    catch (Throwable $e) { error_log('devis.php: ' . $e->getMessage()); out(500, ['error' => 'Erreur du serveur. Réessayez.']); }
    out(404, ['error' => 'Action inconnue.']);
}

/* ---------- page ---------- */
$v = @filemtime(__DIR__ . '/devis.js') ?: 1;
?><!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="csrf" content="<?= h($csrf) ?>">
<title>Devis · CRM Artisan Pisciniste</title>
<link rel="icon" href="/assets/img/favicon-48.png">
<link rel="stylesheet" href="admin.css?v=1"><link rel="stylesheet" href="devis.css?v=<?= $v ?>"></head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="./"><img src="/assets/img/logo.png" alt="" width="30" height="30"><span>CRM <b>Artisan Pisciniste</b></span></a>
  <nav><a href="./" class="tab">Demandes</a><a href="devis.php" class="tab on">Devis</a><a href="./?stats=1" class="tab">Trafic</a><a href="./?logout=1" class="link">Déconnexion</a></nav>
</div></header>
<main class="wrap">
  <nav class="seg dv-nav" id="nav" aria-label="Devis">
    <a href="#nouveau" data-v="nouveau">Nouveau devis</a>
    <a href="#devis" data-v="devis">Mes devis <i id="n-quotes"></i></a>
    <a href="#catalogue" data-v="catalogue">Catalogue <i id="n-products"></i></a>
    <a href="#parametres" data-v="parametres">Entreprise</a>
  </nav>
  <div class="page" id="view"><div class="empty card"><b>Chargement…</b></div></div>
</main>
<div class="toast" id="toast" hidden></div>
<script src="vendor/jspdf.umd.min.js"></script>
<script src="vendor/jspdf.plugin.autotable.min.js"></script>
<script src="devis.js?v=<?= $v ?>"></script>
</body></html>
