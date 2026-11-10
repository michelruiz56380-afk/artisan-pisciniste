<?php
/* Mesure d'audience anonyme du site (appelée par assets/site.js à chaque page vue).
 * Aucun cookie déposé chez le visiteur, aucune adresse IP conservée :
 * seule une empreinte du jour (non réversible, renouvelée chaque jour) sert à compter les visiteurs uniques. */
declare(strict_types=1);
header('Cache-Control: no-store');
$stop = function (): never { http_response_code(204); exit; };
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $stop();
if (!empty($_COOKIE['ap_staff'])) $stop();                                   // visites d'Olivier / de l'admin
$ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|pagespeed|curl|wget|python|java\/|facebookexternalhit|embedly|whatsapp/i', $ua)) $stop();

$d = json_decode((string)file_get_contents('php://input', false, null, 0, 4096), true);
if (!is_array($d)) $stop();
$path = substr((string)($d['p'] ?? ''), 0, 200);
if (!preg_match('#^/[\w\-./%]*$#u', $path) || preg_match('#^/(admin|contact\.php|stat\.php)#', $path)) $stop();
$title = trim(mb_substr(preg_replace('/\s*\|\s*Artisan Pisciniste\s*$/u', '', (string)($d['t'] ?? '')) ?? '', 0, 140));

$self = strtolower(preg_replace('/^www\./', '', (string)($_SERVER['HTTP_HOST'] ?? '')) ?? '');
$host = strtolower(preg_replace('/^www\./', '', (string)parse_url((string)($d['r'] ?? ''), PHP_URL_HOST)) ?? '');
$source = match (true) {
    $host === '' => 'Accès direct',
    $host === $self => 'interne',
    (bool)preg_match('/(^|\.)google\./', $host) => 'Google',
    (bool)preg_match('/(^|\.)bing\.com$/', $host) => 'Bing',
    (bool)preg_match('/(^|\.)(facebook\.com|fb\.com|instagram\.com|l\.messenger\.com)$/', $host) => 'Facebook / Instagram',
    (bool)preg_match('/(^|\.)(pagesjaunes\.fr)$/', $host) => 'PagesJaunes',
    default => $host,
};
$device = preg_match('/Mobi|Android|iPhone|iPad/i', $ua) ? 'Mobile' : 'Ordinateur';

require __DIR__ . '/crm-db.php';
try {
    $salt = crm_setting('salt') ?? crm_setting('salt', bin2hex(random_bytes(16)));
    $tz = new DateTimeZone('Europe/Paris'); $now = new DateTimeImmutable('now', $tz);
    $day = $now->format('Y-m-d');
    $visitor = substr(hash('sha256', $salt . '|' . $day . '|' . ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $ua), 0, 16);
    crm_db()->prepare('INSERT INTO visites (day, at, path, title, source, visitor, device) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$day, $now->format('Y-m-d H:i:s'), $path, $title, $source, $visitor, $device]);
    if (random_int(1, 200) === 1) crm_db()->exec("DELETE FROM visites WHERE day < date('now', '-13 months')");   // durée de conservation
} catch (Throwable $e) { error_log('stat : ' . $e->getMessage()); }
$stop();
