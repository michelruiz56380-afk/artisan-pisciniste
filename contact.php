<?php
/* Formulaire de devis — artisan-pisciniste.fr
 * Envoie la demande par e-mail. Réglage : modifier contact-config.php (adresse de réception). */
declare(strict_types=1);
$cfg = is_file(__DIR__ . '/contact-config.php') ? require __DIR__ . '/contact-config.php' : [];
$TO   = $cfg['to']   ?? '';
$FROM = $cfg['from'] ?? 'site@artisan-pisciniste.fr';

$wantsJson = stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;
function reply(bool $ok, string $msg, bool $json): void {
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($ok ? 200 : 400);
        echo json_encode(['ok' => $ok, 'error' => $ok ? null : $msg], JSON_UNESCAPED_UNICODE);
    } else {
        header('Location: /?envoi=' . ($ok ? 'ok' : 'erreur') . '#contact', true, 303);
    }
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Location: /#contact', true, 303); exit; }
if (!empty($_POST['site'])) reply(true, '', $wantsJson);            // robot : on fait semblant
if ($TO === '') reply(false, "Le formulaire n'est pas encore configuré. Appelez le 06 52 08 92 19.", $wantsJson);

$clean = fn(string $k, int $max) => trim(mb_substr(str_replace(["\r", "\0"], '', (string)($_POST[$k] ?? '')), 0, $max));
$nom = $clean('nom', 120); $tel = $clean('tel', 40); $email = $clean('email', 160);
$commune = $clean('commune', 120); $type = $clean('type', 60); $msg = $clean('message', 5000);
$nom = str_replace("\n", ' ', $nom); $commune = str_replace("\n", ' ', $commune); $type = str_replace("\n", ' ', $type);

// Tous les champs sont obligatoires (même contrôle que dans le navigateur)
$missing = [];
if (mb_strlen($nom) < 2) $missing[] = 'nom et prénom';
if (strlen(preg_replace('/\D/', '', $tel) ?? '') < 10) $missing[] = 'téléphone';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $missing[] = 'e-mail valide';
if (mb_strlen($commune) < 2) $missing[] = 'commune du chantier';
if (mb_strlen($msg) < 5) $missing[] = 'message';
if ($missing) reply(false, 'Merci de compléter : ' . implode(', ', $missing) . '.', $wantsJson);

// limite simple : 1 envoi / 30 s par adresse IP
$lock = sys_get_temp_dir() . '/ap_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
if (is_file($lock) && time() - filemtime($lock) < 30) reply(false, "Merci de patienter quelques secondes avant un nouvel envoi.", $wantsJson);
@touch($lock);

require __DIR__ . '/mail-template.php';
require __DIR__ . '/crm-db.php';
$now  = new DateTimeImmutable('now', new DateTimeZone('Europe/Paris'));
$ref  = crm_new_ref();
$page = parse_url((string)($_SERVER['HTTP_REFERER'] ?? ''), PHP_URL_PATH) ?: '';

// 1. La demande est d'abord enregistrée dans le CRM : elle n'est jamais perdue, même si l'e-mail échoue.
$crmId = 0;
try {
    $crmId = crm_add(['ref' => $ref, 'nom' => $nom, 'tel' => $tel, 'email' => $email, 'commune' => $commune,
                      'type' => $type, 'message' => $msg, 'page' => $page], 'site');
} catch (Throwable $e) {
    error_log('CRM indisponible : ' . $e->getMessage());
}
$host = $_SERVER['HTTP_HOST'] ?? 'artisan-pisciniste.fr';
$crmUrl = $crmId ? 'https://' . $host . '/admin/?id=' . $crmId : '';

// 2. Puis l'e-mail de notification à Olivier.
$mail = ap_devis_email(['nom' => $nom, 'tel' => $tel, 'email' => $email, 'commune' => $commune, 'type' => $type,
                        'message' => $msg, 'ref' => $ref, 'date' => $now, 'page' => $page, 'crm_url' => $crmUrl]);

// E-mail HTML + version texte + logo intégré (affiché même si les images distantes sont bloquées)
$ok = ap_send($TO, $mail['subject'], $mail['html'], $mail['text'], $FROM, 'Site Artisan Pisciniste',
              '=?UTF-8?B?' . base64_encode($nom) . "?= <$email>", '', null, ['X-AP-Reference' => $ref]);
if (!$ok && $crmId) crm_note($crmId, "Attention : l'e-mail de notification n'a pas pu être envoyé.", true);
$saved = $ok || $crmId > 0;
reply($saved, $saved ? '' : "L'envoi a échoué. Appelez le 06 52 08 92 19.", $wantsJson);
